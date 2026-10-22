import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Generate follow-up questions based on the initial query
    const prompt = `Based on this search query: "${query}"

Generate 5 relevant follow-up questions that would help explore this topic further. The questions should:
1. Be directly related to the original query
2. Explore different aspects or deeper details
3. Be concise and clear

Format the response as a JSON array of strings, like:
["question 1", "question 2", "question 3", "question 4", "question 5"]

Only return the JSON array, nothing else.`

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse the JSON response
    try {
      const questions = JSON.parse(content.text)
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