"use client"

import { useState, useCallback, useRef } from "react"
import type { Chat, ChatMessage, Settings } from "@/types/chat"
import { addMessageToChat, deleteChat, updateChat } from "@/app/actions/chat-actions"
import { v4 as uuidv4 } from "uuid"
import { streamSSE } from "@/lib/stream"

interface StreamingDeps {
  currentChat: Chat | null
  setCurrentChat: (chat: Chat | null | ((prev: Chat | null) => Chat | null)) => void
  settings: Settings
  isSearchMode: boolean
  getApiKeyForModel: (modelName: string) => string
  getProviderForModel: (modelName: string) => string
  getTavilyKey: () => string
  createNewChat: () => Promise<Chat>
  loadChats: () => Promise<void>
  selectChat: (id: string) => Promise<Chat | null>
  updateChatStorage: (chat: Chat) => Promise<void>
}

/**
 * Hook for managing message streaming and chat interactions.
 * Handles sending messages, streaming responses, and message editing/deletion.
 */
export function useChatStreaming(deps: StreamingDeps) {
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const depsRef = useRef(deps)
  depsRef.current = deps

  const isGenerating = !!abortController

  /** Abort the currently running generation stream. */
  const stopInference = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }, [abortController])

  /**
   * Send a user message, then stream assistant tokens via SSE and persist the final message.
   */
  const sendMessage = useCallback(async (content: string) => {
    const {
      currentChat,
      setCurrentChat,
      settings,
      isSearchMode,
      getApiKeyForModel,
      getProviderForModel,
      getTavilyKey,
      createNewChat,
      loadChats,
    } = depsRef.current

    // Don't process empty content
    if (!content || content === "") return

    // Abort any existing inference
    stopInference()

    let targetChat = currentChat
    let accumulatedContent = ""
    let accumulatedThinking = ""
    let model = ""
    let provider = ""
    let sources: Record<string, { url: string; score?: number; snippet?: string }> | undefined
    let firstChunkTime: number | null = null
    let thinkingStartTime: number | null = null
    let thinkingEndTime: number | null = null

    // Create new chat if needed
    if (!targetChat) {
      const newChat = await createNewChat()
      targetChat = newChat
    }

    if (!targetChat) {
      console.error("Failed to create or get chat")
      return
    }

    // Add user message
    const userMessage: Omit<ChatMessage, "id" | "createdAt"> = {
      role: "user",
      content,
    }

    const updatedChat = await addMessageToChat(targetChat.id, userMessage)
    if (!updatedChat) {
      if (!currentChat) {
        await deleteChat(targetChat.id)
      }
      return
    }

    setCurrentChat(updatedChat)

    const startTime = Date.now()
    try {
      const key = getApiKeyForModel(settings.activeModel || "")
      model = settings.activeModel || ""
      provider = getProviderForModel(model)

      // Create abort controller
      const controller = new AbortController()
      setAbortController(controller)

      // Stream request
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: updatedChat.messages,
          model: { name: model, provider, key },
          web_search: isSearchMode,
          tavily_api_key: getTavilyKey(),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error("Failed to get response from API")
      }

      // Create temporary message for streaming
      const tempMessage: ChatMessage = {
        role: "assistant",
        content: "",
        model,
        provider,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      }

      setCurrentChat({ ...updatedChat, messages: [...updatedChat.messages, tempMessage] })

      let lastUpdateTime = Date.now()
      const UPDATE_INTERVAL = 100

      const updateTempContent = (
        content: string,
        thinking: string,
        messageSources?: Record<string, { url: string; score?: number; snippet?: string }>
      ) => {
        setCurrentChat((prevChat: Chat | null) => {
          if (!prevChat) return null
          const updatedMessages = prevChat.messages.map((msg: ChatMessage) =>
            msg.id === tempMessage.id ? { ...msg, content, thinking: thinking || undefined, sources: messageSources } : msg
          )
          return { ...prevChat, messages: updatedMessages }
        })
      }

      await streamSSE(response, (data) => {
        if (firstChunkTime === null) firstChunkTime = Date.now()
        if (data.sources && !sources) sources = data.sources

        // Track thinking timing separately
        if (data.thinking && thinkingStartTime === null) {
          thinkingStartTime = Date.now()
        }
        if (data.content && thinkingEndTime === null && thinkingStartTime !== null) {
          thinkingEndTime = Date.now()
        }

        accumulatedContent += data.content || ""
        accumulatedThinking += data.thinking || ""
        const currentTime = Date.now()
        if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
          updateTempContent(accumulatedContent, accumulatedThinking, sources)
          lastUpdateTime = currentTime
        }
      })

      // Final update
      setCurrentChat((prevChat: Chat | null) =>
        prevChat
          ? {
              ...prevChat,
              messages: prevChat.messages.map((m) =>
                m.id === tempMessage.id ? { ...m, content: accumulatedContent, thinking: accumulatedThinking || undefined, sources } : m
              ),
            }
          : null
      )

      // Persist final message
      const endTime = Date.now()
      const duration = firstChunkTime ? endTime - firstChunkTime : endTime - startTime
      // Calculate thinking duration if thinking was present
      const thinkingDuration = thinkingStartTime && thinkingEndTime 
        ? thinkingEndTime - thinkingStartTime 
        : thinkingStartTime 
          ? endTime - thinkingStartTime 
          : undefined

      const persistedChat = await addMessageToChat(targetChat.id, {
        role: "assistant",
        content: accumulatedContent,
        thinking: accumulatedThinking || undefined,
        model,
        provider,
        duration,
        thinkingDuration,
        sources,
      })

      if (persistedChat) setCurrentChat(persistedChat)
      await loadChats()
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Inference stopped by user")
        // Save partial response
        if (accumulatedContent && targetChat) {
          const endTime = Date.now()
          const duration = firstChunkTime ? endTime - firstChunkTime : endTime - startTime

          const persistedChat = await addMessageToChat(targetChat.id, {
            role: "assistant",
            content: accumulatedContent,
            model,
            provider,
            duration,
            sources,
          })

          if (persistedChat) setCurrentChat(persistedChat)
          await loadChats()
        }
      } else {
        console.error("Error getting assistant response:", error)
      }
    } finally {
      setAbortController(null)
    }
  }, [stopInference])

  /** Edit a previously sent user message by truncating and resending. */
  const editAndResendMessage = useCallback(async (messageIdToEdit: string, newContent: string) => {
    const { currentChat, setCurrentChat, selectChat } = depsRef.current
    if (!currentChat || !newContent) return

    try {
      const messageIndex = currentChat.messages.findIndex((msg) => msg.id === messageIdToEdit)
      if (messageIndex === -1) {
        console.error("Message to edit not found:", messageIdToEdit)
        return
      }

      // Truncate and update
      const truncatedMessages = currentChat.messages.slice(0, messageIndex)
      const truncatedChat = { ...currentChat, messages: truncatedMessages }
      setCurrentChat(truncatedChat)
      await updateChat(truncatedChat)

      // Resend
      await sendMessage(newContent)
    } catch (error) {
      console.error("Error editing message:", error)
      if (currentChat) await selectChat(currentChat.id)
    }
  }, [sendMessage])

  /** Delete a message and its adjacent pair. */
  const deleteMessagePair = useCallback(async (messageIdToDelete: string) => {
    const { currentChat, setCurrentChat, selectChat } = depsRef.current
    if (!currentChat) return

    try {
      const messages = currentChat.messages
      const messageIndex = messages.findIndex((msg) => msg.id === messageIdToDelete)

      if (messageIndex === -1) {
        console.error("Message to delete not found:", messageIdToDelete)
        return
      }

      const messageToDelete = messages[messageIndex]
      const indicesToRemove = new Set<number>()

      if (messageToDelete.role === "user") {
        indicesToRemove.add(messageIndex)
        if (messageIndex + 1 < messages.length && messages[messageIndex + 1].role === "assistant") {
          indicesToRemove.add(messageIndex + 1)
        }
      } else if (messageToDelete.role === "assistant") {
        indicesToRemove.add(messageIndex)
        if (messageIndex - 1 >= 0 && messages[messageIndex - 1].role === "user") {
          indicesToRemove.add(messageIndex - 1)
        }
      }

      if (indicesToRemove.size === 0) {
        console.warn("Could not find pair, deleting only target:", messageIdToDelete)
        indicesToRemove.add(messageIndex)
      }

      const newMessages = messages.filter((_, index) => !indicesToRemove.has(index))
      const updatedChatObj = { ...currentChat, messages: newMessages }
      setCurrentChat(updatedChatObj)
      await updateChat(updatedChatObj)
    } catch (error) {
      console.error("Error deleting message pair:", error)
      if (currentChat) await selectChat(currentChat.id)
    }
  }, [])

  return {
    isGenerating,
    stopInference,
    sendMessage,
    editAndResendMessage,
    deleteMessagePair,
  }
}

export type ChatStreamingHook = ReturnType<typeof useChatStreaming>
