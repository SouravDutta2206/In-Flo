"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Chat, ChatMessage, Settings } from "@/types/chat"
import {
  getChats,
  getChatById,
  createChat,
  deleteChat,
  addMessageToChat,
  getSettings,
  updateSettings,
  updateChat,
} from "@/app/actions/chat-actions"
import { v4 as uuidv4 } from "uuid"
import { getApiKeyForModel as _getApiKeyForModel, getProviderForModel as _getProviderForModel } from "@/lib/settings"
import { streamSSE } from "@/lib/stream"

// Local storage key
const SETTINGS_CACHE_KEY = "chat_app_settings"

interface ChatContextType {
  chats: Chat[]
  currentChat: Chat | null
  settings: Settings
  isLoading: boolean
  loadChats: () => Promise<void>
  selectChat: (id: string) => Promise<void>
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
 * ChatProvider owns chat state, settings, and network interactions.
 * It exposes CRUD for chats and messages, streaming send, and settings updates.
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [settings, setSettings] = useState<Settings>({ providers: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [isSearchMode, setIsSearchMode] = useState(false)

  // Helpers
  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true)
    try {
      return await fn()
    } finally {
      setIsLoading(false)
    }
  }

  const getTavilyKey = (): string => settings.providers.find(p => p.Provider === "Tavily")?.Key || ""

  // Load chats and settings on mount
  useEffect(() => {
    const initialize = async () => withLoading(async () => {
      const loadedChats = await getChats()
      setChats(loadedChats)

      if (loadedChats.length > 0) {
        const chat = await getChatById(loadedChats[0].id)
        setCurrentChat(chat)
      }

      // Try to load settings from localStorage first
      const cachedSettings = localStorage.getItem(SETTINGS_CACHE_KEY)
      if (cachedSettings) {
        try {
          setSettings(JSON.parse(cachedSettings))
          return
        } catch (error) {
          console.error("Error parsing cached settings:", error)
        }
      }

      const fileSettings = await getSettings()
      setSettings(fileSettings)
    })

    initialize()
  }, [])

  /** Reload chats from storage and update local state. */
  const loadChats = async () => withLoading(async () => {
    const loadedChats = await getChats()
    setChats(loadedChats)
  })

  /** Select a chat by id and load it into state. */
  const selectChat = async (id: string) => withLoading(async () => {
    const chat = await getChatById(id)
    setCurrentChat(chat)
  })

  /** Create a new chat and set it as current. */
  const createNewChat = async () => withLoading(async () => {
    const newChat = await createChat()
    setChats((prev) => [newChat, ...prev])
    setCurrentChat(newChat)
    return newChat
  })

  /** Delete the currently selected chat and pick the next available one if any. */
  const deleteCurrentChat = async () => {
    if (!currentChat) return

    await withLoading(async () => {
      await deleteChat(currentChat.id)
      const remaining = chats.filter((c) => c.id !== currentChat.id)
      setChats(remaining)
      const next = remaining[0] ? await getChatById(remaining[0].id) : null
      setCurrentChat(next)
    })
  }

  // Function to delete a specific chat by its ID
  /** Delete a specific chat by id, updating current chat if necessary. */
  const deleteChatById = async (id: string) => withLoading(async () => {
    await deleteChat(id)
    const remaining = chats.filter((c) => c.id !== id)
    setChats(remaining)
    if (currentChat?.id === id) {
      const next = remaining[0] ? await getChatById(remaining[0].id) : null
      setCurrentChat(next)
    }
  })

  // Helper function to get API key for the current model
  /** Resolve an API key for the given model from settings. */
  const getApiKeyForModel = (modelName: string): { key: string } => ({ key: _getApiKeyForModel(settings, modelName) })

  /** Abort the currently running generation stream, if any. */
  const stopInference = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  /**
   * Send a user message, then stream assistant tokens via SSE and persist the final message.
   * Maintains a temporary streaming message in state for a responsive UI.
   */
  const sendMessage = async (content: string) => {
    // Don't process empty or undefined content
    if (!content || content === "") {
      return;
    }

    // Abort any existing inference
    stopInference();

    let targetChat = currentChat
    let accumulatedContent = ""
    let model = ""
    let provider = ""
    let sources: Record<string, { url: string; score?: number; snippet?: string }> | undefined = undefined
    let firstChunkTime: number | null = null
    
    // If no current chat, create a new one
    if (!targetChat) {
      const newChat = await createNewChat();
      targetChat = newChat;
    }

    if (!targetChat) {
      console.error("Failed to create or get chat");
      return;
    }

    // Add user message
    const userMessage: Omit<ChatMessage, "id" | "createdAt"> = {
      role: "user",
      content,
    };

    const updatedChat = await addMessageToChat(targetChat.id, userMessage);
    if (!updatedChat) {
      // If message wasn't added (empty/undefined content), delete the new chat if it was just created
      if (!currentChat) {
        await deleteChat(targetChat.id);
      }
      return;
    }

    setCurrentChat(updatedChat)

    // Call API to get assistant response
    const startTime = Date.now();
    try {
      const { key } = getApiKeyForModel(settings.activeModel || "")
      model = settings.activeModel || ""
      provider = getProviderForModel(model)

      // Create new abort controller for this request
      const controller = new AbortController();
      setAbortController(controller);

      // Create fetch request for streaming
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation: updatedChat.messages,
          model: {
            name: model,
            provider: provider,
            key: key,
          },
          web_search: isSearchMode,
          tavily_api_key: getTavilyKey(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get response from API");
      }

      // Create a temporary message object for streaming
      const tempMessage: ChatMessage = {
        role: "assistant",
        content: "",
        model,
        provider,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      }

      // Add the temporary message to the current chat state
      setCurrentChat({ ...updatedChat, messages: [...updatedChat.messages, tempMessage] })

      let lastUpdateTime = Date.now()
      const UPDATE_INTERVAL = 100

      const updateTempContent = (content: string, messageSources?: Record<string, { url: string; score?: number; snippet?: string }>) => {
        setCurrentChat(prevChat => {
          if (!prevChat) return null
          const updatedMessages = prevChat.messages.map((msg: ChatMessage) =>
            msg.id === tempMessage.id ? { ...msg, content, sources: messageSources } : msg
          )
          return { ...prevChat, messages: updatedMessages }
        })
      }

      await streamSSE(response, (data) => {
        // Record time of first chunk arrival
        if (firstChunkTime === null) {
          firstChunkTime = Date.now()
        }
        
        // Capture sources from the first chunk
        if (data.sources && !sources) {
          sources = data.sources
        }
        
        accumulatedContent += data.content || ""
        const currentTime = Date.now()
        if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
          updateTempContent(accumulatedContent, sources)
          lastUpdateTime = currentTime
        }
      })

      setCurrentChat(prevChat => prevChat ? { ...prevChat, messages: prevChat.messages.map((m) => m.id === tempMessage.id ? { ...m, content: accumulatedContent, sources } : m) } : null)

      // Final update to persist in the database
      // Calculate duration from first chunk to last chunk (excludes TTFT)
      const endTime = Date.now();
      const duration = firstChunkTime ? endTime - firstChunkTime : endTime - startTime;

      const persistedChat = await addMessageToChat(targetChat.id, {
        role: "assistant",
        content: accumulatedContent,
        model: model,
        provider: provider,
        duration: duration,
        sources: sources
      });

      if (persistedChat) {
        setCurrentChat(persistedChat);
      }

      await loadChats();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Inference stopped by user');
        // Save the partial response if there is any
        if (accumulatedContent && targetChat) {
          const endTime = Date.now();
          // Use first chunk time if available for consistent timing
          const duration = firstChunkTime ? endTime - firstChunkTime : endTime - startTime;
          
          const persistedChat = await addMessageToChat(targetChat.id, {
            role: "assistant",
            content: accumulatedContent,
            model: model,
            provider: provider,
            duration: duration,
            sources: sources
          });

          if (persistedChat) {
            setCurrentChat(persistedChat);
          }
          await loadChats();
        }
      } else {
        console.error("Error getting assistant response:", error);
      }
    } finally {
      setAbortController(null);
    }
  };

  // Helper function to get provider name for the current model
  /** Find provider identifier for a given model name based on settings. */
  const getProviderForModel = (modelName: string): string => _getProviderForModel(settings, modelName)

  /** Update settings in storage and cache, then update state. */
  const updateChatSettings = async (newSettings: Settings) => {
    try {
      // Save to file
      await updateSettings(newSettings)

      // Save to localStorage
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(newSettings))

      setSettings(newSettings)
    } catch (error) {
      console.error("Error updating settings:", error)
    }
  }

  // Function to handle editing and resending a message
  /**
   * Edit a previously sent user message by truncating the conversation and resending.
   */
  const editAndResendMessage = async (messageIdToEdit: string, newContent: string) => {
    if (!currentChat || !newContent) return;

    setIsLoading(true); // Indicate loading state

    try {
      const messageIndex = currentChat.messages.findIndex(msg => msg.id === messageIdToEdit);

      if (messageIndex === -1) {
        console.error("Message to edit not found:", messageIdToEdit);
        return;
      }

      // 1. Truncate messages array locally
      const truncatedMessages = currentChat.messages.slice(0, messageIndex);

      // 2. Update local state immediately for UI feedback
      const truncatedChat = { ...currentChat, messages: truncatedMessages };
      setCurrentChat(truncatedChat);

      // 3. Persist the truncated chat (overwrite the file)
      await updateChat(truncatedChat);

      // 4. Send the new message (this will add it and trigger backend response)
      // The sendMessage function handles adding the user message and calling the API
      await sendMessage(newContent);

      // Reload chats might be needed if sendMessage doesn't fully update the list
      // await loadChats();
    } catch (error) {
      console.error("Error editing message:", error);
      // Optional: Reload state from disk to revert potential partial UI changes
      if (currentChat) {
         await selectChat(currentChat.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete a message and its pair (user+assistant)
  /**
   * Delete a message and its adjacent pair (user+assistant), depending on the target role.
   */
  const deleteMessagePair = async (messageIdToDelete: string) => {
    if (!currentChat) return;

    setIsLoading(true);
    try {
      const messages = currentChat.messages;
      const messageIndex = messages.findIndex(msg => msg.id === messageIdToDelete);

      if (messageIndex === -1) {
        console.error("Message to delete not found:", messageIdToDelete);
        return;
      }

      const messageToDelete = messages[messageIndex];
      let indicesToRemove = new Set<number>();

      if (messageToDelete.role === 'user') {
        // Delete this user message and the next one (if it's an assistant)
        indicesToRemove.add(messageIndex);
        if (messageIndex + 1 < messages.length && messages[messageIndex + 1].role === 'assistant') {
          indicesToRemove.add(messageIndex + 1);
        }
      } else if (messageToDelete.role === 'assistant') {
        // Delete this assistant message and the previous one (if it's a user)
        indicesToRemove.add(messageIndex);
        if (messageIndex - 1 >= 0 && messages[messageIndex - 1].role === 'user') {
          indicesToRemove.add(messageIndex - 1);
        }
      }

      if (indicesToRemove.size === 0) {
        // Should not happen in normal flow, but as a fallback, remove only the target message
        console.warn("Could not find pair for message, deleting only target:", messageIdToDelete);
        indicesToRemove.add(messageIndex);
      }

      // Create new messages array excluding the ones to be removed
      const newMessages = messages.filter((_, index) => !indicesToRemove.has(index));

      // Update local state and persist
      const updatedChat = { ...currentChat, messages: newMessages };
      setCurrentChat(updatedChat);
      await updateChat(updatedChat);
    } catch (error) {
      console.error("Error deleting message pair:", error);
      // Optional: Revert UI changes on error by reloading
      if (currentChat) {
        await selectChat(currentChat.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    chats,
    currentChat,
    settings,
    isLoading,
    loadChats,
    selectChat,
    createNewChat,
    deleteCurrentChat,
    sendMessage,
    updateChatSettings,
    deleteChatById,
    editAndResendMessage,
    deleteMessagePair,
    stopInference,
    isGenerating: !!abortController,
    isSearchMode,
    setIsSearchMode,
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

