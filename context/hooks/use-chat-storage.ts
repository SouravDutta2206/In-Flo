"use client"

import { useState, useCallback } from "react"
import type { Chat } from "@/types/chat"
import {
  getChats,
  getChatById,
  createChat as persistCreateChat,
  deleteChat as persistDeleteChat,
  updateChat as persistUpdateChat,
} from "@/app/actions/chat-actions"

/**
 * Hook for managing chat storage operations (CRUD).
 * Handles loading, creating, selecting, and deleting chats.
 */
export function useChatStorage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /** Wrap async operations with loading state. */
  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true)
    try {
      return await fn()
    } finally {
      setIsLoading(false)
    }
  }

  /** Load all chats from storage and optionally select the first one. */
  const loadChats = useCallback(async (selectFirst = false) => {
    return withLoading(async () => {
      const loadedChats = await getChats()
      setChats(loadedChats)
      
      if (selectFirst && loadedChats.length > 0) {
        const chat = await getChatById(loadedChats[0].id)
        setCurrentChat(chat)
      }
      
      return loadedChats
    })
  }, [])

  /** Select a chat by id and load it into state. */
  const selectChat = useCallback(async (id: string) => {
    return withLoading(async () => {
      const chat = await getChatById(id)
      setCurrentChat(chat)
      return chat
    })
  }, [])

  /** Create a new chat and set it as current. */
  const createNewChat = useCallback(async () => {
    return withLoading(async () => {
      const newChat = await persistCreateChat()
      setChats((prev) => [newChat, ...prev])
      setCurrentChat(newChat)
      return newChat
    })
  }, [])

  /** Delete the currently selected chat and pick the next available one. */
  const deleteCurrentChat = useCallback(async () => {
    if (!currentChat) return

    await withLoading(async () => {
      await persistDeleteChat(currentChat.id)
      const remaining = chats.filter((c) => c.id !== currentChat.id)
      setChats(remaining)
      const next = remaining[0] ? await getChatById(remaining[0].id) : null
      setCurrentChat(next)
    })
  }, [currentChat, chats])

  /** Delete a specific chat by id, updating current chat if necessary. */
  const deleteChatById = useCallback(async (id: string) => {
    await withLoading(async () => {
      await persistDeleteChat(id)
      const remaining = chats.filter((c) => c.id !== id)
      setChats(remaining)
      if (currentChat?.id === id) {
        const next = remaining[0] ? await getChatById(remaining[0].id) : null
        setCurrentChat(next)
      }
    })
  }, [currentChat, chats])

  /** Update a chat in storage and state. */
  const updateChat = useCallback(async (chat: Chat) => {
    await persistUpdateChat(chat)
    setChats(prev => prev.map(c => c.id === chat.id ? chat : c))
    if (currentChat?.id === chat.id) {
      setCurrentChat(chat)
    }
  }, [currentChat])

  return {
    chats,
    currentChat,
    isLoading,
    setCurrentChat,
    setIsLoading,
    loadChats,
    selectChat,
    createNewChat,
    deleteCurrentChat,
    deleteChatById,
    updateChat,
  }
}

export type ChatStorageHook = ReturnType<typeof useChatStorage>
