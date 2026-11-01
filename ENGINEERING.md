# Engineering notes

Contracts, invariants, verification, and the defects behind the current shape of
the code. Read this before changing the agent loop or a route handler.

## Runtime and toolchain

| Thing | Value | Note |
|---|---|---|
| Node | 22+ | Required, not advisory: the test scripts use `--experimental-strip-types` and `@mendable/firecrawl-js` declares `>=22`. `engines` enforces it. |
| Next.js | 15 (App Router) | Server components by default; the chat surface is a client component. |
| React | 19 | |
| TypeScript | strict | `tsc --noEmit` is clean; there are no `any` or `@ts-ignore` in application code. |
| Tailwind | v4 | Tokens live in `app/globals.css` under `@theme`. See `DESIGN_SYSTEM.md`. |
| Lint | `eslint .` | Runs during the build. Vendored libraries are excluded in `eslint.config.mjs`. |

## Boundaries and contracts

### HTTP routes

| Route | Input | Contract |
|---|---|---|
| `POST /api/open-researcher` | `{ query, dataset? }` | SSE stream: `event` frames, then one `response`, then `done`. Errors arrive as an `error` frame, not a status code, because the response has already begun. |
| `POST /api/open-researcher/follow-up` | `{ query }` | `{ questions: string[] }` |
| `GET /api/corpus-search` | `q`, `dataset?`, `limit?` | `{ query, dataset, count, hits }` |
| `POST /api/check-key` | `{ apiKey, provider?, accountId?, model? }` | `{ ok, provider, model, error? }`. `200` even when the key is bad: the answer is the payload, not the status. |
| `POST /api/tts`, `/api/voice/*` | provider-shaped bodies | Audio bytes or `{ error }` |

Every route validates its input through `lib/validate.ts` before doing work.
That module is dependency-free on purpose. A wrong shape produces a `400` with a
sentence, for example `dataset must be a dataset code such as CIV or PEN.`

### Credentials

Precedence, highest first:

1. A per-request header from the browser: `X-LLM-API-Key`, `X-LLM-Provider`,
   `X-LLM-Model`, `X-Cloudflare-Account`, `X-Firecrawl-API-Key`.
2. The deployment's environment: `SARVAM_API_KEY`, `CLOUDFLARE_API_TOKEN` and so on.

**Invariant: a request-supplied key is never written to `process.env`.** It is
passed down the call chain as an argument and used for that request only. The
earlier implementation assigned to `process.env`, which leaked one visitor's key
into the next request.

**Invariant: a key's shape selects its provider** (`providerForKey`): `cfat_` is
Cloudflare, `sk-ant-` is Anthropic. An unrecognised shape falls back to the
configured provider, so a credential cannot be sent to the wrong service by
omission.

### Provider adapters (`lib/llm.ts`)

`createChat(request, options)` is the only way the agent talks to a model. Each
adapter converts the internal block shape to its wire format and back, and maps
failures onto three prefixes the routes can recognise: `Authentication error:`,
`Model error:`, and a generic `<Provider> API error (status)`.

Client instances are cached **per key** and the caches are bounded to 20
entries. An unbounded map keyed by credentials is a slow leak on a long-lived
server.

## The agent loop (`lib/open-researcher-agent.ts`)

- Bounded to `LLM_MAX_STEPS` (default 16). The upstream template recursed with no
  bound.
- Tool results are returned to the model in the same conversation, in order.
- **Grounding invariant:** if the first turn produces no tool call, the agent
  searches the corpus itself, emits the same `tool_call` / `tool_result` events,
  and asks the model to answer from those sections. A model that ignores tools
  must not answer California law from memory.
- **Cancellation invariant:** a closed browser aborts the run. The route passes an
  `AbortSignal` down through `runResearch` into the provider fetch. The loop
  checks it between steps. Previously the only thing that stopped a run was
  `controller.enqueue` throwing after the client had gone.

## Failure handling

- SSE writes go through one `send()` helper that swallows enqueue failures and
  aborts the run. Writing to a closed controller is not an error to report.
- A cancelled run emits nothing further. It is not reported as a failure to a
  client that has left.
- Upstream error bodies are surfaced with the provider's own wording, truncated,
  and never include the credential.

## Verification

```bash
npm run lint          # eslint, application code only
npm run test:units    # 37 assertions: validators, providerForKey, hostnameOf
npm run test:sse      # 8 assertions: the streaming frame parser
npm run smoke         # 50 end-to-end checks against local API stand-ins
npm run test          # all three
npm run build         # production build, lint included
```

The smoke suite starts the real server against local stand-ins for Sarvam,
Firecrawl and Cartesia, so it needs no keys and no network. It covers the happy
path, cancellation, bad credentials, upstream 500s, malformed bodies, and the
corpus.

Manual checks that were run for the last pass, and how: a headless browser at
390×844 and 1440×900 driving a real question through to a cited answer, the
threads drawer opening and closing, keyboard focus measured on the composer and
on buttons, and every route loading with a `main` landmark and an `h1`.

## Defects found and fixed, with causes

| Symptom | Root cause |
|---|---|
| App would not build | `app/search/page.tsx` had an unterminated template literal inside `<Script src={...}`. A second agent added it; the deploy had been failing since. |
| Answers truncated at random | The client split each network chunk on newlines and dropped frames that did not parse. Now uses `lib/sse.ts`. |
| Page crashed on any cited answer | `new URL(citation.url)` threw on corpus citations, which have no URL. Now `hostnameOf`. |
| Web search ignored the key from the UI | One Firecrawl client cached from the env var at first use; the route wrote the UI key into `process.env`. Now per-key, per-request. |
| Threads drawer transparent, text unreadable | `components/ui/sidebar.tsx` uses `bg-sidebar`; the token was never defined. |
| Cancellation only "worked" | It worked by exception: `enqueue` threw after the client left. Now an explicit abort signal. |
| `Number('abc')` reached the corpus search | `limit` was coerced without validation, producing `NaN`. Now `integer()`. |
| Cloudflare token sent to Sarvam | Nothing inspected the key's shape. Now `providerForKey`. |

## Known limitations

- No live verification against the real providers from this environment: the
  sandbox proxy refuses `api.cloudflare.com`, `*.vercel.app` and
  `r.assistant-ui.com`. Provider behaviour is tested against stand-ins that
  mirror the documented response shapes.
- No measured contrast audit of every token pair, and no screen-reader pass on a
  physical device.
- No Core Web Vitals measurement. The corpus (72 MB) is served as static assets
  and excluded from function bundles via `outputFileTracingExcludes`; that
  decision is deliberate but unmeasured.
- `components/velora` is vendored and untokenised.
- The Google Programmable Search widget on `/search` renders in Google's own
  iframe, so its styling is outside the design system.
