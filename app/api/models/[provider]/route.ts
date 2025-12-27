import { NextRequest, NextResponse } from "next/server"
import ollama from "ollama"

// Edge runtime for low latency on proxy routes
export const runtime = "edge"

type RouteContext = {
  params: Promise<{ provider: string }>
}

/**
 * Unified model fetching endpoint for all providers.
 * 
 * GET /api/models/ollama - Local Ollama models
 * GET /api/models/openrouter - OpenRouter public models
 * POST /api/models/gemini - Gemini models (requires api_key)
 * POST /api/models/groq - Groq models (requires api_key)
 */

export async function GET(req: NextRequest, context: RouteContext) {
  const { provider } = await context.params

  try {
    switch (provider.toLowerCase()) {
      case "ollama":
        return await handleOllama()
      case "openrouter":
        return await handleOpenRouter()
      default:
        return NextResponse.json(
          { error: `GET not supported for provider: ${provider}. Use POST with api_key.` },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    console.error(`Error in ${provider} models API:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { provider } = await context.params

  try {
    const body = await req.json()

    if (!body.api_key) {
      return NextResponse.json({ error: "API key is required" }, { status: 401 })
    }

    switch (provider.toLowerCase()) {
      case "gemini":
        return await handleGemini(body.api_key)
      case "groq":
        return await handleGroq(body.api_key)
      default:
        return NextResponse.json(
          { error: `POST not supported for provider: ${provider}. Use GET.` },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    console.error(`Error in ${provider} models API:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// --- Provider Handlers ---

async function handleOllama() {
  // Note: ollama package doesn't work in edge runtime, 
  // so we need to use node runtime or fetch directly
  try {
    const response = await fetch("http://localhost:11434/api/tags")
    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}`)
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to connect to Ollama. Is it running?" },
      { status: 503 }
    )
  }
}

async function handleOpenRouter() {
  const response = await fetch("https://openrouter.ai/api/v1/models")
  if (!response.ok) {
    throw new Error(`OpenRouter API returned ${response.status}`)
  }
  const data = await response.json()
  return NextResponse.json(data)
}

async function handleGemini(apiKey: string) {
  const response = await fetch("http://localhost:8000/api/gemini/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  })

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to get response from backend" },
      { status: response.status }
    )
  }

  const data = await response.json()
  return NextResponse.json(data)
}

async function handleGroq(apiKey: string) {
  const response = await fetch("http://localhost:8000/api/groq/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  })

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to get response from backend" },
      { status: response.status }
    )
  }

  const data = await response.json()
  return NextResponse.json(data)
}
