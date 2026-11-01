<h1 align="center">California Law</h1>

<p align="center">
  <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGJncnpmamlzc3RnMzNpeXNwcGk1Z3kwemd6c2w1ZDdxcGZwdWJwdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hhNLykzY76wu7oGFU0/giphy.gif" alt="California Law Demo" width="100%">
</p>

A powerful AI-powered research tool that combines Firecrawl's web scraping capabilities with advanced AI reasoning to help you search, analyze, and understand web content.

## Features

- **AI-Powered Search**: Intelligently search and analyze web content
- **Real-time Web Scraping**: Powered by Firecrawl for accurate, up-to-date information
- **Thinking Display**: See the AI's reasoning process in real-time
- **Smart Citations**: Automatic source tracking and citation generation
- **Split View Interface**: Side-by-side view of chat and search results
- **Voice Playback**: Listen to completed answers with Cartesia Sonic text-to-speech

## Prerequisites

- Node.js 22+ and npm (the test scripts use `--experimental-strip-types`, and `@mendable/firecrawl-js` requires Node 22)
- API Keys (at least one model-provider key required):
  - `SARVAM_API_KEY` - For AI functionality (default model: `sarvam-105b`)
  - `VENICE_API_KEY` - Optional uncensored alternative provider
  - `ANTHROPIC_API_KEY` - Optional fallback provider (Claude)
  - `FIRECRAWL_API_KEY` - Optional for web search/scraping (can be added via UI); California corpus research works without it
  - `CARTESIA_API_KEY` - Optional for voice playback of completed answers

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

   You can also skip the environment entirely: open the app, choose **API keys** in the
   menu (or the **Add key** banner), and paste your key. It is kept in your browser and
   sent with each request, so a deployment with no keys configured still works. For a
   shared or public deployment, set the key in the environment instead — a key in a
   browser is readable by anything else running in that browser.

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
| `FIRECRAWL_BASE_URL` | No | Point the Firecrawl SDK at a proxy or self-hosted deployment (default `https://api.firecrawl.dev`) |
| `SARVAM_MODEL` | No | Sarvam model id (default `sarvam-105b`) |
| `SARVAM_BASE_URL` | No | Default `https://api.sarvam.ai/v1` |
| `SARVAM_REASONING_EFFORT` | No | `low` \| `medium` \| `high` \| `none` |
| `LLM_PROVIDER` | No | `sarvam` (default), `cloudflare`, `venice`, or `anthropic` |
| `CLOUDFLARE_API_TOKEN` | No | Cloudflare Workers AI token; provider `cloudflare` |
| `CLOUDFLARE_ACCOUNT_ID` | No | Cloudflare account id, required with the token above |
| `CLOUDFLARE_MODEL` | No | Workers AI model (default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`); must support tool calling |
| `VENICE_API_KEY` | No | Venice key; uncensored alternative provider (`venice-uncensored-1-2`) |
| `VENICE_MODEL` | No | Venice model id (default `venice-uncensored-1-2`) |
| `ANTHROPIC_API_KEY` | No | Fallback provider, used when no Sarvam key is set |
| `ANTHROPIC_MODEL` | No | Default `claude-opus-4-8` |
| `CARTESIA_API_KEY` | No | Cartesia key; enables the Listen button (Sonic TTS) |
| `CARTESIA_MODEL` | No | Cartesia model id (default `sonic-3.6`) |
| `CARTESIA_VOICE_ID` | No | Cartesia voice id (defaults to Skylar — Friendly Guide) |
| `CARTESIA_VERSION` | No | Cartesia API version header (default `2026-08-14`) |

*Can be provided through the UI if not set in environment variables

## Getting API Keys

- **Sarvam API Key**: Visit [Sarvam AI dashboard](https://dashboard.sarvam.ai)
- **Firecrawl API Key**: Visit [Firecrawl](https://www.firecrawl.dev/)
- **Venice API Key** (optional uncensored provider): Visit [Venice API settings](https://venice.ai/settings/api)
- **Cartesia API Key** (optional voice playback): Visit [Cartesia Playground](https://play.cartesia.ai/)
- **Anthropic API Key** (optional fallback): Visit [Anthropic Console](https://console.anthropic.com/)

## Usage

1. **Basic Search**: Enter your query in the chat interface
2. **Web Analysis**: The AI will automatically search and analyze relevant web content
3. **Follow-up Questions**: Ask follow-up questions to dive deeper
4. **View Sources**: Click on citations to see source information

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

# End-to-end tests (needs Node 22; every upstream API is a local stand-in,
# so no keys or network access are required)
npm run test
```

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