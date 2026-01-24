import { NextResponse } from 'next/server'

/**
 * Proxies file clear requests to the Python backend.
 * Clears the entire file upload database.
 */
export async function DELETE() {
  try {
    const response = await fetch('http://localhost:8000/api/files/clear', {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Failed to clear files' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in file clear API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
