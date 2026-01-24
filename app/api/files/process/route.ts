import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxies file upload requests to the Python backend.
 * Handles multipart form data for PDF uploads.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    
    // Forward the request to the Python backend
    const response = await fetch('http://localhost:8000/api/files/process', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Failed to process file' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in file process API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
