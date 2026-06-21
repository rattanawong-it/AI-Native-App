/**
 * Chat Client Library
 * ใช้ Streaming (SSE) เรียก /api/chat/stream พร้อมรองรับ sessionId
 */

export async function sendChatMessage(
  message: string,
  sessionId: string | null,
  onChunk: (accumulatedContent: string) => void
): Promise<string> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${res.status}`)
  }

  if (!res.body) {
    throw new Error("No response body")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ""
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Parse SSE lines
    const lines = buffer.split("\n")
    buffer = lines.pop() || "" // เก็บ incomplete line ไว้

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim()
        if (data === "[DONE]") continue

        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            fullContent += parsed.content
            onChunk(fullContent)
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  }

  return fullContent
}