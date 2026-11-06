import { createChat, isProviderConfigured, providerDefaults, type LlmProvider } from './llm'

export interface ProviderHealth {
  provider: LlmProvider
  label: string
  configured: boolean
  ok: boolean
  status: number | null
  message: string
}

export const HEALTH_PROVIDERS: Array<{ id: LlmProvider; label: string }> = [
  { id: 'sarvam', label: 'Sarvam AI' },
  { id: 'venice', label: 'Venice' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'cloudflare', label: 'Cloudflare Workers AI' },
  { id: 'orchestrate', label: 'IBM watsonx Orchestrate' },
]

/**
 * Asks one provider to answer a one-word prompt.
 *
 * This exists because "the provider doesn't work" is not a diagnosis: a missing
 * key, a rejected key, an unfunded account and a network failure all look the
 * same from the chat. One tiny real request separates them.
 */
export async function checkProvider(id: LlmProvider): Promise<ProviderHealth> {
  const label = HEALTH_PROVIDERS.find((entry) => entry.id === id)?.label ?? id
  const { apiKeyEnv } = providerDefaults(id)

  if (!isProviderConfigured(id)) {
    return {
      provider: id,
      label,
      configured: false,
      ok: false,
      status: null,
      message: `Not configured. ${apiKeyEnv} is unset.`,
    }
  }

  try {
    const result = await createChat(
      {
        system: 'Reply with the single word OK.',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 8,
      },
      { provider: id }
    )
    const answered = Boolean(result.text && result.text.trim())
    return {
      provider: id,
      label,
      configured: true,
      ok: answered,
      status: 200,
      message: answered
        ? `Works. ${result.model} answered.`
        : 'Reached the provider, but it returned an empty answer.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const match = /HTTP (\d{3})/.exec(message)
    return {
      provider: id,
      label,
      configured: true,
      ok: false,
      status: match ? Number(match[1]) : null,
      message: message.slice(0, 300),
    }
  }
}
