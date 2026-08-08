import { NextRequest, NextResponse } from "next/server"

/**
 * Aggregate model-listing proxy.
 *
 * POST /api/models
 * Body: { groq_api_key?: string, gemini_api_key?: string }
 *
 * Proxies the request to the Python backend and returns the response unchanged.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const response = await fetch("http://localhost:8000/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch models from backend" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error("Error in aggregate models API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
