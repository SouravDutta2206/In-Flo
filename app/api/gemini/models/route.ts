import { NextRequest, NextResponse } from "next/server";

// Edge runtime keeps latency low when proxying to Python backend
export const runtime = 'edge'

/**
 * Validates presence of API key and forwards request to Python backend for Gemini models.
 */
export async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      
      
      if (!body.api_key) {
        return NextResponse.json(
          { error: 'API key is required' },
          { status: 401 }
        );
      }

      // Forward the request to the Python backend
      const response = await fetch('http://localhost:8000/api/gemini/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: body.api_key })
      });
  
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to get response from backend' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
      
    } catch (error) {
        console.error('Error in Gemini models API:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
    }
}
