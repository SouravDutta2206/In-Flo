/** A single message in a chat conversation. */
export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
  model?: string
  provider?: string
  duration?: number
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
