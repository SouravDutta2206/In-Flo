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

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [settings, setSettings] = useState<Settings>({ providers: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [isSearchMode, setIsSearchMode] = useState(false)

  // Load chats and settings on mount
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true)
      try {
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
          } catch (error) {
            console.error("Error parsing cached settings:", error)
            // If error parsing cache, load from file
            const fileSettings = await getSettings()
            setSettings(fileSettings)
          }
        } else {
          // If no cache, load from file
          const fileSettings = await getSettings()
          setSettings(fileSettings)
        }
      } catch (error) {
        console.error("Error initializing chat context:", error)
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [])

  const loadChats = async () => {
    setIsLoading(true)
    try {
      const loadedChats = await getChats()
      setChats(loadedChats)
    } catch (error) {
      console.error("Error loading chats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectChat = async (id: string) => {
    setIsLoading(true)
    try {
      const chat = await getChatById(id)
      setCurrentChat(chat)
    } catch (error) {
      console.error(`Error selecting chat ${id}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNewChat = async () => {
    setIsLoading(true)
    try {
      const newChat = await createChat()
      setChats((prev) => [newChat, ...prev])
      setCurrentChat(newChat)
      return newChat
    } catch (error) {
      console.error("Error creating new chat:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCurrentChat = async () => {
    if (!currentChat) return

    setIsLoading(true)
    try {
      await deleteChat(currentChat.id)
      setChats((prev) => prev.filter((chat) => chat.id !== currentChat.id))

      if (chats.length > 1) {
        const nextChat = chats.find((chat) => chat.id !== currentChat.id)
        if (nextChat) {
          const chat = await getChatById(nextChat.id)
          setCurrentChat(chat)
        } else {
          setCurrentChat(null)
        }
      } else {
        setCurrentChat(null)
      }
    } catch (error) {
      console.error(`Error deleting chat ${currentChat.id}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  // Function to delete a specific chat by its ID
  const deleteChatById = async (id: string) => {
    setIsLoading(true)
    try {
      await deleteChat(id)
      const remainingChats = chats.filter((chat) => chat.id !== id)
      setChats(remainingChats)

      // If the deleted chat was the current one, select the next available chat
      if (currentChat?.id === id) {
        if (remainingChats.length > 0) {
          const nextChat = await getChatById(remainingChats[0].id)
          setCurrentChat(nextChat)
        } else {
          setCurrentChat(null)
        }
      }
    } catch (error) {
      console.error(`Error deleting chat ${id}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to get API key for the current model
  const getApiKeyForModel = (modelName: string): { key: string } => {
    // If we have an activeProvider in settings and it matches the current model, get the key from the provider config
    if (settings.activeModel === modelName && settings.activeProvider) {
      const provider = settings.providers.find(p => p.Provider.toLowerCase() === settings.activeProvider?.toLowerCase());
      if (provider) {
        return { key: provider.Key };
      }
    }

    // Otherwise, try to find provider in the settings
    for (const provider of settings.providers) {
      const models = provider.Models.split(",").map((m) => m.trim())

      if (models.includes(modelName)) {
        return { key: provider.Key }
      }
    }

    // Default to first provider if no match
    return {
      key: settings.providers[0]?.Key || "",
    }
  }

  const stopInference = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const sendMessage = async (content: string) => {
    // Don't process empty or undefined content
    if (!content || content === "") {
      return;
    }

    // Abort any existing inference
    stopInference();

    let targetChat = currentChat;
    let accumulatedContent = "";
    let model = "";
    let provider = "";
    
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

    setCurrentChat(updatedChat);

    // Call API to get assistant response
    try {
      const { key } = getApiKeyForModel(settings.activeModel || "");
      model = settings.activeModel || "";
      provider = getProviderForModel(model);

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
          tavily_api_key: settings.providers.find(p => p.Provider === "Tavily")?.Key || "",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get response from API");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      let assistantMessage: Omit<ChatMessage, "id" | "createdAt"> = {
        role: "assistant",
        content: "",
        model: model,
        provider: provider
      };

      // Create a temporary message object for streaming
      const tempMessage: ChatMessage = {
        ...assistantMessage,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      };

      // Add the temporary message to the current chat state
      const initialMessages = [...updatedChat.messages, tempMessage];
      const initialChatState = {
        ...updatedChat,
        messages: initialMessages
      };
      setCurrentChat(initialChatState);

      let lastUpdateTime = Date.now();
      const UPDATE_INTERVAL = 100;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              accumulatedContent += data.content;
              
              // Only update the UI if enough time has passed
              const currentTime = Date.now();
              if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
                setCurrentChat(prevChat => {
                  if (!prevChat) return null;
                  
                  const updatedMessages = prevChat.messages.map((msg: ChatMessage) => 
                    msg.id === tempMessage.id 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  );

                  return {
                    ...prevChat,
                    messages: updatedMessages,
                  };
                });
                lastUpdateTime = currentTime;
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      setCurrentChat(prevChat => {
        if (!prevChat) return null;
        
        const updatedMessages = prevChat.messages.map((msg: ChatMessage) => 
          msg.id === tempMessage.id 
            ? { ...msg, content: accumulatedContent }
            : msg
        );

        return {
          ...prevChat,
          messages: updatedMessages,
        };
      });

      // Final update to persist in the database
      await addMessageToChat(targetChat.id, {
        role: "assistant",
        content: accumulatedContent,
        model: model,
        provider: provider
      });

      await loadChats();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Inference stopped by user');
        // Save the partial response if there is any
        if (accumulatedContent && targetChat) {
          await addMessageToChat(targetChat.id, {
            role: "assistant",
            content: accumulatedContent,
            model: model,
            provider: provider
          });
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
  const getProviderForModel = (modelName: string): string => {
    // If we have an activeProvider in settings and it matches the current model, use it
    if (settings.activeModel === modelName && settings.activeProvider) {
      const provider = settings.activeProvider.toLowerCase();
      // Normalize Google Gemini to gemini
      if (provider === "google gemini") return "gemini";
      return provider;
    }

    // Otherwise, try to find provider in the settings
    for (const provider of settings.providers) {
      const models = provider.Models.split(",").map((m) => m.trim())

      if (models.includes(modelName)) {
        let providerName = provider.Provider.toLowerCase()
        if (providerName === "huggingface") return "huggingface"
        if (providerName === "openrouter") return "openrouter"
        if (providerName === "google gemini") return "gemini"
        if (providerName === "ollama") return "ollama"
        if (providerName === "groq") return "groq"
      }
    }

    // Default to ollama if no match
    return "No Provider Found"
  }

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

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}

