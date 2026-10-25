<h1 align="center">California Law</h1>

<p align="center">
  <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGJncnpmamlzc3RnMzNpeXNwcGk1Z3kwemd6c2w1ZDdxcGZwdWJwdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hhNLykzY76wu7oGFU0/giphy.gif" alt="California Law Demo" width="100%">
</p>

California legal research over the full text of the California codes, Rules of Court and Judicial Council forms, answered with citations to the section. The chat is built on [assistant-ui](https://www.assistant-ui.com/).

## Features

- **California law corpus**: Every code section, court rule and Judicial Council form, searched by the research agent before it answers
- **Cited answers**: every substantive claim points at the section it relies on; citation markers open the source
- **Research steps**: the model's thinking and each tool call are shown as they happen, not after the fact
- **Streaming**: answers render as they arrive, through a parser that survives frames split across network chunks
- **Threads**: several conversations, kept in the browser
- **Listen**: answers read aloud with Cartesia Sonic, streaming so playback starts on the first sentence; the voice and speed are chosen in the composer
- **Ask by voice**: dictation in the composer through the browser's recogniser, or Cartesia Ink on browsers without one
- **Accessible**: assistant-ui primitives, keyboard-usable composer, live dictation status

## Prerequisites

- Node.js 20+ and npm
- API Keys (at least one model-provider key required):
  - `SARVAM_API_KEY` - For AI functionality (default model: `sarvam-105b`)
  - `VENICE_API_KEY` - Optional uncensored alternative provider
  - `ANTHROPIC_API_KEY` - Optional fallback provider (Claude)
  - `FIRECRAWL_API_KEY` - Optional for web search/scraping (can be added via UI); California corpus research works without it
  - `CARTESIA_API_KEY` - Optional. Enables Cartesia voices for Listen and Cartesia Ink for dictation; without it Listen falls back to the browser's own voice

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/mendableai/open-researcher
   cd open-researcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your API keys:
   ```
   SARVAM_API_KEY=your_sarvam_api_key
   FIRECRAWL_API_KEY=your_firecrawl_api_key   # Optional, can be added via UI
   CARTESIA_API_KEY=your_cartesia_api_key     # Optional, enables Cartesia voice
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SARVAM_API_KEY` | Yes | Sarvam AI key; the agent runs on `sarvam-105b` |
| `FIRECRAWL_API_KEY` | No* | Firecrawl API key for web search and scraping |
| `SARVAM_MODEL` | No | Sarvam model id (default `sarvam-105b`) |
| `SARVAM_BASE_URL` | No | Default `https://api.sarvam.ai/v1` |
| `SARVAM_REASONING_EFFORT` | No | `low` \| `medium` \| `high` \| `none` |
| `LLM_PROVIDER` | No | `sarvam` (default), `venice`, or `anthropic` |
| `VENICE_API_KEY` | No | Venice key; uncensored alternative provider (`venice-uncensored-1-2`) |
| `VENICE_MODEL` | No | Venice model id (default `venice-uncensored-1-2`) |
| `ANTHROPIC_API_KEY` | No | Fallback provider, used when no Sarvam key is set |
| `ANTHROPIC_MODEL` | No | Default `claude-opus-4-8` |
| `CARTESIA_API_KEY` | No | Cartesia key; enables Cartesia voices for Listen and Ink for dictation |
| `CARTESIA_TTS_MODEL` | No | Cartesia TTS model id (default `sonic-3.6`) |
| `CARTESIA_STT_MODEL` | No | Cartesia STT model id (default `ink-whisper`) |
| `CARTESIA_VOICE_ID` | No | Cartesia voice id (defaults to Skylar — Friendly Guide) |
| `CARTESIA_VERSION` | No | Cartesia API version header (default `2026-08-14`) |

*Can be provided through the UI if not set in environment variables

## Getting API Keys

- **Sarvam API Key**: Visit [Sarvam AI dashboard](https://dashboard.sarvam.ai)
- **Firecrawl API Key**: Visit [Firecrawl](https://www.firecrawl.dev/)
- **Venice API Key** (optional uncensored provider): Visit [Venice API settings](https://venice.ai/settings/api)
- **Cartesia API Key** (optional voice): Visit [Cartesia Playground](https://play.cartesia.ai/)
- **Anthropic API Key** (optional fallback): Visit [Anthropic Console](https://console.anthropic.com/)

## Usage

1. **Ask**: type a question (or press the microphone and speak it) and get an answer cited to the section
2. **Scope**: restrict a thread to one code or dataset from the Search in menu
3. **Sources**: hover a citation marker like [1] to see the page or section behind it
4. **Listen**: press Listen under any answer to hear it with the Cartesia voice picked in the composer
5. **Threads**: keep several lines of research; they survive a reload

## Project Structure

```
app/
├── api/                     # Route handlers (research, corpus, voice)
├── page.tsx                 # The chat application
└── layout.tsx               # Root layout
components/
├── assistant-chat/          # The assistant-ui chat: store, thread, messages, voice controls
├── voice-picker.tsx         # Cartesia voice and speed
└── ui/                      # shadcn/ui primitives
lib/
├── chat-stream.ts           # SSE payloads -> one assistant turn
├── sse.ts                   # SSE frame reader
├── voice/                   # Cartesia-backed assistant-ui speech + dictation adapters
└── open-researcher-agent.ts # The research loop
scripts/                     # SSE, chat-stream, UI (jsdom) and end-to-end tests
public/corpus/               # The dataset (not in git)
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Tests: SSE reader (8), chat stream reducer (12), the chat screen in a real
# DOM via jsdom (21), then the built routes against local stand-ins (60).
# `npm test` runs them in that order and needs `npm run build` first.
npm test
npm run test:sse
npm run test:chat
npm run test:ui
npm run smoke
```

See [docs/assistant-ui-verification.md](docs/assistant-ui-verification.md) for
what the chat screen's tests cover and what they do not.

## Tech Stack

- **Next.js 15** - React framework
- **assistant-ui** - Chat primitives and the external-store runtime
- **Cartesia** - Sonic text-to-speech and Ink speech-to-text
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Sarvam AI (`sarvam-105b`)** - AI model (OpenAI-compatible chat completions)
- **Firecrawl** - Web scraping
- **Radix UI** - UI components

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Firecrawl](https://www.firecrawl.dev/) for powerful web scraping
- Chat UI built with [assistant-ui](https://www.assistant-ui.com/)
- Voice by [Cartesia](https://cartesia.ai/) (Sonic and Ink)
- Powered by [Anthropic's Claude](https://www.anthropic.com/) for AI capabilities
- UI components from [Radix UI](https://www.radix-ui.com/) and [shadcn/ui](https://ui.shadcn.com/)