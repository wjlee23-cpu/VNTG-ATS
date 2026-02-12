import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export type AIProvider = 'openai' | 'anthropic'

export function getAIClient(provider: AIProvider = 'openai') {
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    return new OpenAI({ apiKey })
  } else if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    return new Anthropic({ apiKey })
  }
  throw new Error(`Unsupported AI provider: ${provider}`)
}

export async function generateText(
  provider: AIProvider,
  prompt: string,
  options?: {
    model?: string
    maxTokens?: number
    temperature?: number
  }
): Promise<string> {
  if (provider === 'openai') {
    const client = getAIClient('openai') as OpenAI
    const response = await client.chat.completions.create({
      model: options?.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature || 0.7,
    })
    return response.choices[0]?.message?.content || ''
  } else {
    const client = getAIClient('anthropic') as Anthropic
    const response = await client.messages.create({
      model: options?.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature || 0.7,
      messages: [{ role: 'user', content: prompt }],
    })
    return response.content[0]?.type === 'text' ? response.content[0].text : ''
  }
}
