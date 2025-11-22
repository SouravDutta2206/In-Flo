import { NextRequest } from 'next/server'

// Run this route on the Edge runtime to minimize latency for SSE proxying
export const runtime = 'edge'

/**
 * Proxies chat requests to the Python backend and transparently streams SSE back to the client.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Forward the request to the Python backend
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: req.signal, // Forward the abort signal
    })

    if (!response.ok) {
      throw new Error('Failed to get response from backend')
    }

    // Create a TransformStream to forward the streaming response
    const { readable, writable } = new TransformStream()
    
    // Forward the stream from Python backend to client
    response.body?.pipeTo(writable)

    // Return the readable stream to the client
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response('Request aborted', { status: 499 }) // Use 499 status code for client closed request
    }
    console.error('Error in chat API:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}