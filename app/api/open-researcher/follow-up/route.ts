import { NextRequest, NextResponse } from 'next/server'
import { createChat, isProviderConfigured, providerDefaults, resolveProvider } from '@/lib/llm'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // The research provider (Sarvam by default, Anthropic as a fallback)
    // answers follow-up generation too, so one key covers both routes.
    const provider = resolveProvider()
    if (!isProviderConfigured(provider)) {
      return NextResponse.json(
        { error: `${providerDefaults(provider).apiKeyEnv} is not configured` },
        { status: 500 }
      )
    }

    // Generate follow-up questions based on the initial query
    const prompt = `Based on this search query: "${query}"

Generate 5 relevant follow-up questions that would help explore this topic further. The questions should:
1. Be directly related to the original query
2. Explore different aspects or deeper details
3. Be concise and clear

Format the response as a JSON array of strings, like:
["question 1", "question 2", "question 3", "question 4", "question 5"]

Only return the JSON array, nothing else.`

    const result = await createChat({
      system: 'You write concise follow-up research questions and reply with JSON only.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 400,
    })

    // Reasoning-capable models may return thinking blocks before the answer,
    // so use the concatenated text rather than the first block.
    const text = result.text
    if (!text) {
      throw new Error('Unexpected response type')
    }

    // Parse the JSON response (tolerating a Markdown code fence)
    try {
      const json = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
      const questions = JSON.parse(json)
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array')
      }

      return NextResponse.json({ questions })
    } catch {
      // Failed to parse follow-up questions
      return NextResponse.json({ questions: [] })
    }

  } catch (error) {
    // Error generating follow-up questions
    return NextResponse.json(
      { error: 'Failed to generate follow-up questions' },
      { status: 500 }
    )
  }
}
