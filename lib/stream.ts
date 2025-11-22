/**
 * Read a text/event-stream Response and call onChunk for each parsed data payload.
 * Expects lines in the form `data: { json }`.
 */
export async function streamSSE(response: Response, onChunk: (data: any) => void) {
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) throw new Error("No reader available")

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    const lines = chunk.split("\n")
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6))
          onChunk(data)
        } catch {
          // ignore malformed lines
        }
      }
    }
  }
}


