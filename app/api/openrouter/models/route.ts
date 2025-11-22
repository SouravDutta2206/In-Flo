import { NextResponse } from 'next/server';

/**
 * Fetches public model list from OpenRouter.
 * Note: This endpoint does not forward API keys and relies on public availability.
 */
export async function GET() {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      if (!response.ok) {
        throw new Error(`OpenRouter API returned ${response.status}`);
      }
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message || 'Failed to fetch models' },
        { status: 500 }
      );
    }
  }