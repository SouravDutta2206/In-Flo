import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'http://localhost:8000'

/**
 * Catch-all proxy for document bank sub-routes.
 * Replaces individual route files for [bankId], [bankId]/files, and [bankId]/files/[filename].
 */
async function proxy(req: NextRequest, path: string) {
  try {
    const url = `${BACKEND}/api/document-banks/${path}`
    const init: RequestInit = { method: req.method }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const contentType = req.headers.get('content-type') || ''
      if (contentType.includes('multipart/form-data')) {
        init.body = await req.formData()
      } else {
        init.headers = { 'Content-Type': 'application/json' }
        init.body = JSON.stringify(await req.json())
      }
    }

    const response = await fetch(url, init)
    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Request failed' },
        { status: response.status }
      )
    }
    return NextResponse.json(await response.json())
  } catch (error) {
    console.error(`Error proxying document-banks/${path}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxy(req, path.join('/'))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxy(req, path.join('/'))
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxy(req, path.join('/'))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxy(req, path.join('/'))
}
