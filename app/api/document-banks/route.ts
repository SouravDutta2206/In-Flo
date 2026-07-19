import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxies document bank list and create requests to the Python backend.
 */
export async function GET() {
  try {
    const response = await fetch('http://localhost:8000/api/document-banks')
    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Failed to list banks' },
        { status: response.status }
      )
    }
    return NextResponse.json(await response.json())
  } catch (error) {
    console.error('Error listing document banks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const response = await fetch('http://localhost:8000/api/document-banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Failed to create bank' },
        { status: response.status }
      )
    }
    return NextResponse.json(await response.json())
  } catch (error) {
    console.error('Error creating document bank:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
