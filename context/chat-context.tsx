"use client"

import type React from "react"
import { createContext, useContext, useEffect } from "react"
import type { Chat, ChatMessage, Settings } from "@/types/chat"
import { useChatSettings } from "@/context/hooks/use-chat-settings"
import { useChatStorage } from "@/context/hooks/use-chat-storage"
import { useChatStreaming } from "@/context/hooks/use-chat-streaming"

interface ChatContextType {
  chats: Chat[]
  currentChat: Chat | null
  settings: Settings
  isLoading: boolean
  loadChats: () => Promise<void>
  selectChat: (id: string) => Promise<Chat | null>
  createNewChat: () => Promise<Chat>
  deleteCurrentChat: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  updateChatSettings: (settings: Settings) => Promise<void>
  deleteChatById: (id: string) => Promise<void>
  editAndResendMessage: (messageIdToEdit: string, newContent: string) => Promise<void>
  deleteMessagePair: (messageIdToDelete: string) => Promise<void>
  stopInference: () => void
  isGenerating: boolean
  isSearchMode: boolean
  setIsSearchMode: (value: boolean) => void
}

// React context containing chat state, settings, and chat operations
const ChatContext = createContext<ChatContextType | undefined>(undefined)

/**
 * ChatProvider composes chat hooks and exposes unified context.
 * Delegates to:
 * - useChatSettings: settings CRUD, API key resolution
 * - useChatStorage: chat CRUD operations
 * - useChatStreaming: message streaming, edit/delete
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Initialize hooks
  const settingsHook = useChatSettings()
  const storageHook = useChatStorage()

  // Streaming hook depends on storage and settings
  const streamingHook = useChatStreaming({
    currentChat: storageHook.currentChat,
    setCurrentChat: storageHook.setCurrentChat,
    settings: settingsHook.settings,
    isSearchMode: settingsHook.isSearchMode,
    getApiKeyForModel: settingsHook.getApiKeyForModel,
    getProviderForModel: settingsHook.getProviderForModel,
    getTavilyKey: settingsHook.getTavilyKey,
    createNewChat: storageHook.createNewChat,
    loadChats: async () => { await storageHook.loadChats(false) },
    selectChat: storageHook.selectChat,
    updateChatStorage: storageHook.updateChat,
  })

  // Initialize on mount: load chats and settings
  useEffect(() => {
    const initialize = async () => {
      await storageHook.loadChats(true) // Load chats and select first
    }
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Compose context value from hooks
  const value: ChatContextType = {
    // Storage
    chats: storageHook.chats,
    currentChat: storageHook.currentChat,
    isLoading: storageHook.isLoading,
    loadChats: async () => { await storageHook.loadChats(false) },
    selectChat: storageHook.selectChat,
    createNewChat: storageHook.createNewChat,
    deleteCurrentChat: storageHook.deleteCurrentChat,
    deleteChatById: storageHook.deleteChatById,

    // Settings
    settings: settingsHook.settings,
    updateChatSettings: settingsHook.updateChatSettings,
    isSearchMode: settingsHook.isSearchMode,
    setIsSearchMode: settingsHook.setIsSearchMode,

    // Streaming
    sendMessage: streamingHook.sendMessage,
    editAndResendMessage: streamingHook.editAndResendMessage,
    deleteMessagePair: streamingHook.deleteMessagePair,
    stopInference: streamingHook.stopInference,
    isGenerating: streamingHook.isGenerating,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

/** Access the chat context; must be used within a ChatProvider. */
export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}
