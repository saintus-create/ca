import { NextResponse } from 'next/server';
import { providerDefaults, resolveProvider } from '@/lib/llm';

export async function GET() {
  // Sarvam AI is the default model provider; Anthropic is the fallback.
  const provider = resolveProvider();
  const { apiKeyEnv, model } = providerDefaults(provider);

  const environmentStatus = {
    FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
    SARVAM_API_KEY: !!process.env.SARVAM_API_KEY,
    VENICE_API_KEY: !!process.env.VENICE_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    LLM_PROVIDER: provider,
    LLM_MODEL: model,
    LLM_KEY_ENV: apiKeyEnv,
    LLM_KEY_CONFIGURED: !!process.env[apiKeyEnv],
    FIRESTARTER_DISABLE_CREATION_DASHBOARD: process.env.FIRESTARTER_DISABLE_CREATION_DASHBOARD === 'true',
  };

  // Add debug info (only in development)
  const debugInfo = process.env.NODE_ENV === 'development' ? {
    sarvamKeyPrefix: process.env.SARVAM_API_KEY ? process.env.SARVAM_API_KEY.substring(0, 6) + '...' : 'NOT SET',
    anthropicKeyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    firecrawlKeyPrefix: process.env.FIRECRAWL_API_KEY ? process.env.FIRECRAWL_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    nodeEnv: process.env.NODE_ENV
  } : {};

  return NextResponse.json({ 
    environmentStatus,
    ...debugInfo
  });
} 
