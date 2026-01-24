/** A single message in a chat conversation. */
export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  thinking?: string
  createdAt: string
  model?: string
  provider?: string
  duration?: number
  thinkingDuration?: number
  sources?: Record<string, { url: string; score?: number; snippet?: string }>
}

/** A persisted chat thread containing messages and metadata. */
export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  model?: string
}

/** Provider credentials and model list loaded from settings. */
export interface ProviderConfig {
  Provider: string
  Key: string
  Models: string
}

/** App settings including provider configurations and active selection. */
export interface Settings {
  providers: ProviderConfig[]
  activeModel?: string
  activeProvider?: string
}

/** Uploaded file reference for chat context (RAG mode). */
export interface FileContext {
  name: string
  content?: string  // Optional - not stored in RAG mode
  tokens?: number
  chunks?: number   // Number of chunks stored in vector DB
  status?: string   // 'uploaded' when successfully processed
}
