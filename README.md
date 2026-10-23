<h1 align="center">Open Researcher</h1>

<p align="center">
  <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGJncnpmamlzc3RnMzNpeXNwcGk1Z3kwemd6c2w1ZDdxcGZwdWJwdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hhNLykzY76wu7oGFU0/giphy.gif" alt="Open Researcher Demo" width="100%">
</p>

A powerful AI-powered research tool that combines Firecrawl's web scraping capabilities with advanced AI reasoning to help you search, analyze, and understand web content.

## Features

- **AI-Powered Search**: Intelligently search and analyze web content
- **Real-time Web Scraping**: Powered by Firecrawl for accurate, up-to-date information
- **Thinking Display**: See the AI's reasoning process in real-time
- **Smart Citations**: Automatic source tracking and citation generation
- **Split View Interface**: Side-by-side view of chat and search results
- **Voice (Cartesia)**: Listen to any answer read aloud with Sonic, and ask
  questions by microphone with Ink

## Prerequisites

- Node.js 18+ and npm
- API Keys (at least one required):
  - `SARVAM_API_KEY` - For AI functionality (default model: `sarvam-105b`)
  - `FIRECRAWL_API_KEY` - For web scraping (can be added via UI)
  - `ANTHROPIC_API_KEY` - Optional fallback provider (Claude)

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
   ANTHROPIC_API_KEY=your_anthropic_api_key
   FIRECRAWL_API_KEY=your_firecrawl_api_key  # Optional, can be added via UI
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
| `LLM_PROVIDER` | No | `sarvam` (default) or `anthropic` |
| `ANTHROPIC_API_KEY` | No | Fallback provider, used when no Sarvam key is set |
| `ANTHROPIC_MODEL` | No | Default `claude-opus-4-8` |
| `CARTESIA_API_KEY` | No | Enables voice: read answers aloud and ask by mic |
| `CARTESIA_VOICE_ID` | No | Reading voice; defaults to the first on the account |
| `CARTESIA_TTS_MODEL` | No | Default `sonic-3.6` |
| `CARTESIA_STT_MODEL` | No | Default `ink-whisper` |

*Can be provided through the UI if not set in environment variables

## Getting API Keys

- **Sarvam API Key**: Visit [Sarvam AI dashboard](https://dashboard.sarvam.ai)
- **Firecrawl API Key**: Visit [Firecrawl](https://www.firecrawl.dev/)
- **Anthropic API Key** (optional fallback): Visit [Anthropic Console](https://console.anthropic.com/)
- **Cartesia API Key** (optional voice): Visit [play.cartesia.ai/keys](https://play.cartesia.ai/keys)

## Usage

1. **Basic Search**: Enter your query in the chat interface
2. **Web Analysis**: The AI will automatically search and analyze relevant web content
3. **Follow-up Questions**: Ask follow-up questions to dive deeper
4. **View Sources**: Click on citations to see source information
5. **Listen**: Press the speaker on any answer to hear it read aloud; press
   again to stop. Pick the voice and speed from the header
6. **Ask by voice**: Press the microphone in the input, speak, then press it
   again — the transcript lands in the input so you can edit before sending

## Project Structure

```
open-research/
├── app/
│   ├── api/              # API routes
│   ├── open-researcher/  # Main application page
│   └── layout.tsx        # Root layout
├── components/           # React components
│   ├── ui/              # UI components
│   └── thinking-chat.tsx # Main chat interface
├── lib/                 # Utility functions
└── public/              # Static assets
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
```

## Testing

```bash
npm run build && npm test
```

`npm test` runs the SSE parser unit tests, then an end-to-end smoke test that
starts the production server against local stand-ins for Sarvam, Firecrawl and
Cartesia and drives the real routes: a full research run (including a stream
chopped into 7-byte fragments), the corpus, follow-up questions, voice in both
directions, per-request API keys, cancellation, and the failure modes — bad key,
upstream 500, empty model reply, missing key. No network access or secrets
required, so it works in CI.

## Tech Stack

- **Next.js 15** - React framework
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
- Powered by [Anthropic's Claude](https://www.anthropic.com/) for AI capabilities
- UI components from [Radix UI](https://www.radix-ui.com/) and [shadcn/ui](https://ui.shadcn.com/)