// Provider-agnostic chat layer for the research agent.
//
// The app talks to Sarvam AI by default (sarvam-105b on the OpenAI-compatible
// chat completions API). Venice is supported as an alternative provider
// (venice-uncensored-1-2, an uncensored Dolphin fine-tune, on Venice's
// OpenAI-compatible API). Anthropic remains supported as a fallback, so an
// existing deployment that only has ANTHROPIC_API_KEY keeps working.
//
// Selection order:
//   1. LLM_PROVIDER=sarvam|venice|anthropic, when set explicitly.
//   2. sarvam when SARVAM_API_KEY is present.
//   3. anthropic when ANTHROPIC_API_KEY is present.
//   4. venice when VENICE_API_KEY is present.
//   5. sarvam (so the error names the variable that is actually missing).
//
// Messages and responses use a single internal shape (Anthropic-style content
// blocks, which are a superset of what this app needs). Each provider adapter
// converts to and from that shape, so the agent loop is written once.

import Anthropic from '@anthropic-ai/sdk';

export type LlmProvider = 'sarvam' | 'venice' | 'anthropic' | 'cloudflare';

export interface LlmTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Extra fields (Anthropic `signature`, Sarvam ids, ...) are preserved so that
// provider responses can be replayed to the same provider unchanged.
export interface LlmBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  [key: string]: unknown;
}

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string | LlmBlock[];
}

export interface ChatRequest {
  system: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  maxTokens?: number;
}

export interface ChatResult {
  blocks: LlmBlock[];
  // Concatenated text blocks, for callers that only need the answer.
  text: string;
  provider: LlmProvider;
  model: string;
}

const SARVAM_DEFAULT_BASE_URL = 'https://api.sarvam.ai/v1';
const SARVAM_DEFAULT_MODEL = 'sarvam-105b';
const VENICE_DEFAULT_BASE_URL = 'https://api.venice.ai/api/v1';
const VENICE_DEFAULT_MODEL = 'venice-uncensored-1-2';
const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4-8';
// Workers AI's OpenAI-compatible endpoint. The model must support tool calling,
// because the research agent reaches the corpus through a tool.
const CLOUDFLARE_DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TIMEOUT_MS = 180_000;

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function resolveProvider(): LlmProvider {
  const explicit = envValue('LLM_PROVIDER')?.toLowerCase();
  if (
    explicit === 'sarvam' ||
    explicit === 'venice' ||
    explicit === 'anthropic' ||
    explicit === 'cloudflare'
  ) {
    return explicit;
  }
  if (envValue('SARVAM_API_KEY')) return 'sarvam';
  if (envValue('CLOUDFLARE_API_TOKEN')) return 'cloudflare';
  if (envValue('ANTHROPIC_API_KEY')) return 'anthropic';
  if (envValue('VENICE_API_KEY')) return 'venice';
  return 'sarvam';
}

/**
 * Guess the provider from the shape of a key, so a credential cannot be sent to
 * the wrong service. A Cloudflare token starts cfat_, an Anthropic key sk-ant-.
 * Returns undefined when the shape says nothing, and the caller falls back to
 * the configured provider.
 */
export function providerForKey(key: string | undefined): LlmProvider | undefined {
  const value = key?.trim();
  if (!value) return undefined;
  if (value.startsWith('cfat_')) return 'cloudflare';
  if (value.startsWith('sk-ant-')) return 'anthropic';
  return undefined;
}

export function providerDefaults(provider: LlmProvider): { model: string; apiKeyEnv: string } {
  switch (provider) {
    case 'cloudflare':
      return {
        model: envValue('CLOUDFLARE_MODEL') ?? CLOUDFLARE_DEFAULT_MODEL,
        apiKeyEnv: 'CLOUDFLARE_API_TOKEN',
      };
    case 'venice':
      return { model: envValue('VENICE_MODEL') ?? VENICE_DEFAULT_MODEL, apiKeyEnv: 'VENICE_API_KEY' };
    case 'anthropic':
      return { model: envValue('ANTHROPIC_MODEL') ?? ANTHROPIC_DEFAULT_MODEL, apiKeyEnv: 'ANTHROPIC_API_KEY' };
    default:
      return { model: envValue('SARVAM_MODEL') ?? SARVAM_DEFAULT_MODEL, apiKeyEnv: 'SARVAM_API_KEY' };
  }
}

export function isProviderConfigured(provider: LlmProvider, apiKeyOverride?: string): boolean {
  if (apiKeyOverride?.trim()) return true;
  return Boolean(envValue(providerDefaults(provider).apiKeyEnv));
}

/** Per-request overrides. A key supplied by the browser is used for that one
 *  request and never written into process.env, so one visitor's key cannot be
 *  picked up by the next. */
export interface ChatOptions {
  apiKey?: string;
  provider?: LlmProvider;
  /** Cloudflare account id, needed only by the Cloudflare provider. */
  accountId?: string;
}

export async function createChat(request: ChatRequest, options?: ChatOptions): Promise<ChatResult> {
  const provider = options?.provider ?? resolveProvider();
  const { model } = providerDefaults(provider);
  const blocks =
    provider === 'cloudflare'
      ? await cloudflareChat(model, request, options?.apiKey, options?.accountId)
      : provider === 'venice'
        ? await veniceChat(model, request, options?.apiKey)
        : provider === 'anthropic'
          ? await anthropicChat(model, request, options?.apiKey)
          : await sarvamChat(model, request, options?.apiKey);

  return {
    blocks,
    text: blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim(),
    provider,
    model,
  };
}

// ---------------------------------------------------------------------------
// Sarvam AI (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

interface OpenAiToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

function toOpenAiMessages(system: string, messages: LlmMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  if (system) out.push({ role: 'system', content: system });

  for (const message of messages) {
    if (typeof message.content === 'string') {
      out.push({ role: message.role, content: message.content });
      continue;
    }

    if (message.role === 'assistant') {
      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n')
        .trim();
      const toolCalls = message.content.filter((block) => block.type === 'tool_use');
      const payload: OpenAiMessage = { role: 'assistant', content: text || null };
      if (toolCalls.length > 0) {
        payload.tool_calls = toolCalls.map((call, index) => ({
          id: call.id ?? `call_${index}`,
          type: 'function' as const,
          function: {
            name: call.name ?? '',
            arguments: JSON.stringify(call.input ?? {}),
          },
        }));
      }
      out.push(payload);
      continue;
    }

    // Tool results must immediately follow the assistant turn that asked for
    // them, so they are emitted before any user text.
    for (const block of message.content) {
      if (block.type === 'tool_result') {
        out.push({
          role: 'tool',
          tool_call_id: block.tool_use_id ?? '',
          content: String(block.content ?? ''),
        });
      }
    }
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();
    if (text) out.push({ role: 'user', content: text });
  }
  return out;
}

function safeParseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function sarvamChat(model: string, request: ChatRequest, apiKeyOverride?: string): Promise<LlmBlock[]> {
  const apiKey = apiKeyOverride?.trim() || envValue('SARVAM_API_KEY');
  if (!apiKey) {
    throw new Error('Authentication error: SARVAM_API_KEY is not set.');
  }

  const baseUrl = (envValue('SARVAM_BASE_URL') ?? SARVAM_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const reasoningEffort = envValue('SARVAM_REASONING_EFFORT')?.toLowerCase();

  const body: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(request.system, request.messages),
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
    body.tool_choice = 'auto';
  }

  // low | medium | high (Sarvam's default is medium); "none" disables it.
  if (reasoningEffort && ['low', 'medium', 'high', 'none'].includes(reasoningEffort)) {
    body.reasoning_effort = reasoningEffort === 'none' ? null : reasoningEffort;
  }

  const timeoutMs = Number.parseInt(envValue('LLM_TIMEOUT_MS') ?? '', 10) || DEFAULT_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-subscription-key': apiKey,
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Network error calling Sarvam: ${reason}`);
  }

  const raw = await response.text();

  if (!response.ok) {
    let detail = raw.slice(0, 600);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
      const parsedMessage =
        typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? parsed.message;
      if (parsedMessage) detail = parsedMessage;
    } catch {
      // keep the raw body snippet
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication error: Sarvam rejected SARVAM_API_KEY. ${detail}`);
    }
    if (response.status === 404 || /model/i.test(detail)) {
      throw new Error(`Model error: Sarvam model "${model}" is not available. Set SARVAM_MODEL. ${detail}`);
    }
    throw new Error(`Sarvam API error (${response.status}): ${detail}`);
  }

  let payload: {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
        tool_calls?: OpenAiToolCall[];
      };
    }>;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Sarvam returned a response that was not valid JSON.');
  }

  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error('Sarvam returned no completion choices.');
  }

  const blocks: LlmBlock[] = [];
  const reasoning = message.reasoning_content?.trim();
  if (reasoning) {
    blocks.push({ type: 'thinking', thinking: reasoning });
  }

  for (const [index, call] of (message.tool_calls ?? []).entries()) {
    blocks.push({
      type: 'tool_use',
      id: call.id ?? `call_${index}`,
      name: call.function?.name ?? '',
      input: safeParseArguments(call.function?.arguments),
    });
  }

  const text = message.content?.trim();
  if (text) {
    blocks.push({ type: 'text', text });
  }

  if (blocks.length === 0) {
    throw new Error('Sarvam returned an empty message (no text, reasoning, or tool calls).');
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Cloudflare Workers AI (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

/**
 * Cloudflare's AI gateway speaks the OpenAI chat-completions shape, so the
 * request and response handling mirrors Sarvam's. What differs is the URL,
 * which is scoped to an account, and the single bearer credential.
 *
 * The model has to support tool calling: the research agent reaches California
 * law through a tool, and a model that ignores tools cannot answer from the
 * corpus at all.
 */
async function cloudflareChat(
  model: string,
  request: ChatRequest,
  apiKeyOverride?: string,
  accountIdOverride?: string,
): Promise<LlmBlock[]> {
  const apiKey = apiKeyOverride?.trim() || envValue('CLOUDFLARE_API_TOKEN');
  if (!apiKey) {
    throw new Error('Authentication error: CLOUDFLARE_API_TOKEN is not set.');
  }

  const accountId = accountIdOverride?.trim() || envValue('CLOUDFLARE_ACCOUNT_ID');
  if (!accountId) {
    throw new Error(
      'Cloudflare needs an account id. Set CLOUDFLARE_ACCOUNT_ID, or add it with the key in the app.',
    );
  }

  const timeoutMs = Number.parseInt(envValue('LLM_TIMEOUT_MS') ?? '', 10) || DEFAULT_TIMEOUT_MS;
  // CLOUDFLARE_BASE_URL exists so the provider can be pointed at a local
  // stand-in in tests, and at a gateway proxy in a locked-down network.
  const base = envValue('CLOUDFLARE_BASE_URL') ?? 'https://api.cloudflare.com/client/v4';
  const url = `${base.replace(/\/+$/, '')}/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(request.system, request.messages),
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
  if (request.tools?.length) {
    body.tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Network error calling Cloudflare: ${reason}`);
  }

  const raw = await response.text();

  if (!response.ok) {
    let detail = raw.slice(0, 600);
    try {
      const parsed = JSON.parse(raw) as {
        errors?: Array<{ message?: string }>;
        error?: { message?: string } | string;
        message?: string;
      };
      const message =
        (typeof parsed.error === 'string' ? parsed.error : parsed.error?.message) ??
        parsed.errors?.[0]?.message ??
        parsed.message;
      if (message) detail = message;
    } catch {
      // keep the raw body snippet
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication error: Cloudflare rejected CLOUDFLARE_API_TOKEN. ${detail}`);
    }
    if (response.status === 404 || /model/i.test(detail)) {
      throw new Error(
        `Model error: Cloudflare model "${model}" is not available for this account. Set CLOUDFLARE_MODEL. ${detail}`,
      );
    }
    throw new Error(`Cloudflare API error (${response.status}): ${detail}`);
  }

  let payload: {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
        tool_calls?: OpenAiToolCall[];
      };
    }>;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Cloudflare returned a response that was not valid JSON.');
  }

  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error('Cloudflare returned no completion choices.');
  }

  const blocks: LlmBlock[] = [];
  const reasoning = message.reasoning_content?.trim();
  if (reasoning) blocks.push({ type: 'thinking', thinking: reasoning });

  for (const [index, call] of (message.tool_calls ?? []).entries()) {
    blocks.push({
      type: 'tool_use',
      id: call.id ?? `call_${index}`,
      name: call.function?.name ?? '',
      input: safeParseArguments(call.function?.arguments),
    });
  }

  const text = message.content?.trim();
  if (text) blocks.push({ type: 'text', text });

  if (blocks.length === 0) {
    throw new Error('Cloudflare returned an empty message (no text, reasoning, or tool calls).');
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Venice (OpenAI-compatible chat completions; uncensored models)
// ---------------------------------------------------------------------------

async function veniceChat(model: string, request: ChatRequest, apiKeyOverride?: string): Promise<LlmBlock[]> {
  const apiKey = apiKeyOverride?.trim() || envValue('VENICE_API_KEY');
  if (!apiKey) {
    throw new Error('Authentication error: VENICE_API_KEY is not set.');
  }

  const baseUrl = (envValue('VENICE_BASE_URL') ?? VENICE_DEFAULT_BASE_URL).replace(/\/+$/, '');

  const body: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(request.system, request.messages),
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    // Venice prepends its own system prompt by default; the agent supplies
    // its own, so turn Venice's off.
    venice_parameters: { include_venice_system_prompt: false },
  };

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
    body.tool_choice = 'auto';
  }

  const timeoutMs = Number.parseInt(envValue('LLM_TIMEOUT_MS') ?? '', 10) || DEFAULT_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Network error calling Venice: ${reason}`);
  }

  const raw = await response.text();

  if (!response.ok) {
    let detail = raw.slice(0, 600);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
      const parsedMessage =
        typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? parsed.message;
      if (parsedMessage) detail = parsedMessage;
    } catch {
      // keep the raw body snippet
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication error: Venice rejected VENICE_API_KEY. ${detail}`);
    }
    if (response.status === 404 || /model/i.test(detail)) {
      throw new Error(`Model error: Venice model "${model}" is not available. Set VENICE_MODEL. ${detail}`);
    }
    throw new Error(`Venice API error (${response.status}): ${detail}`);
  }

  let payload: {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
        tool_calls?: OpenAiToolCall[];
      };
    }>;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Venice returned a response that was not valid JSON.');
  }

  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error('Venice returned no completion choices.');
  }

  const blocks: LlmBlock[] = [];
  const reasoning = message.reasoning_content?.trim();
  if (reasoning) {
    blocks.push({ type: 'thinking', thinking: reasoning });
  }

  for (const [index, call] of (message.tool_calls ?? []).entries()) {
    blocks.push({
      type: 'tool_use',
      id: call.id ?? `call_${index}`,
      name: call.function?.name ?? '',
      input: safeParseArguments(call.function?.arguments),
    });
  }

  const text = message.content?.trim();
  if (text) {
    blocks.push({ type: 'text', text });
  }

  if (blocks.length === 0) {
    throw new Error('Venice returned an empty message (no text, reasoning, or tool calls).');
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Anthropic (fallback provider)
// ---------------------------------------------------------------------------

// One client per key, so a request that carries its own key does not reuse
// (or overwrite) the one built from the environment.
const anthropicClients = new Map<string, Anthropic>();

function getAnthropicClient(apiKeyOverride?: string): Anthropic {
  const apiKey = apiKeyOverride?.trim() || envValue('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('Authentication error: ANTHROPIC_API_KEY is not set.');
  }
  const cached = anthropicClients.get(apiKey);
  if (cached) return cached;
  // Long generations need headroom, and a streaming request keeps bytes
  // flowing so idle-connection timeouts don't kill it (see anthropicChat).
  const client = new Anthropic({ apiKey, timeout: 600_000, maxRetries: 1 });
  anthropicClients.set(apiKey, client);
  return client;
}

type AnthropicCreateParams = Parameters<Anthropic['messages']['create']>[0];

async function anthropicChat(model: string, request: ChatRequest, apiKeyOverride?: string): Promise<LlmBlock[]> {
  const messages = request.messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === 'string'
        ? message.content
        : message.content.map((block) => {
            if (block.type === 'tool_result') {
              return {
                type: 'tool_result',
                tool_use_id: block.tool_use_id,
                content: block.content ?? '',
              };
            }
            return block;
          }),
  }));

  const params = {
    model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: request.system,
    messages,
    ...(request.tools && request.tools.length > 0 ? { tools: request.tools } : {}),
    // Adaptive thinking interleaves reasoning between tool calls on its own
    // (no interleaved-thinking beta header) and `summarized` keeps the
    // reasoning summaries this UI renders.
    thinking: { type: 'adaptive' as const, display: 'summarized' as const },
  };

  let response: Anthropic.Message;
  try {
    // Stream rather than a single request: with thinking enabled the model can
    // produce nothing for many seconds before the first byte, and an idle
    // connection gets cut by proxies and some serverless edges. Streaming keeps
    // data flowing.
    response = (await getAnthropicClient(apiKeyOverride)
      .messages.stream(params as unknown as AnthropicCreateParams)
      .finalMessage()) as unknown as Anthropic.Message;
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Unknown error';
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403 || /authentication/i.test(raw)) {
      throw new Error(`Authentication error: Anthropic rejected ANTHROPIC_API_KEY. ${raw}`);
    }
    if (status === 404 || /model/i.test(raw)) {
      throw new Error(`Model error: Anthropic model "${model}" is not available. Set ANTHROPIC_MODEL. ${raw}`);
    }
    throw new Error(`Anthropic API error: ${raw}`);
  }

  return response.content
    .filter(
      (block): block is Anthropic.ThinkingBlock | Anthropic.TextBlock | Anthropic.ToolUseBlock =>
        block.type === 'thinking' || block.type === 'text' || block.type === 'tool_use'
    )
    .map((block) => ({ ...block }) as unknown as LlmBlock);
}
