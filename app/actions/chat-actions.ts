"use server"

import fs from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import type { Chat, ChatMessage, Settings, ProviderConfig } from "@/types/chat"

const DATA_DIR = path.join(process.cwd(), "data")
const CHATS_DIR = path.join(DATA_DIR, "chats")
const SETTINGS_FILE = path.join(process.cwd(), "data","app_config.json")

// Small helpers for JSON IO
async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8")
  return JSON.parse(content) as T
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

// Ensure directories exist on disk for chats/settings persistence
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.mkdir(CHATS_DIR, { recursive: true })
  } catch (error) {
    console.error("Error creating directories:", error)
  }
}

/** Return all chats sorted by updatedAt desc. */
export async function getChats(): Promise<Chat[]> {
  await ensureDirectories()

  try {
    const files = await fs.readdir(CHATS_DIR)
    const chatFiles = files.filter((file) => file.endsWith(".json"))

    const chats = await Promise.all(
      chatFiles.map(async (file) => readJson<Chat>(path.join(CHATS_DIR, file)))
    )

    return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch (error) {
    console.error("Error reading chats:", error)
    return []
  }
}

/** Return a single chat by id or null if missing. */
export async function getChatById(id: string): Promise<Chat | null> {
  try {
    return await readJson<Chat>(path.join(CHATS_DIR, `${id}.json`))
  } catch (error) {
    console.error(`Error reading chat ${id}:`, error)
    return null
  }
}

/** Create and persist a new chat file. */
export async function createChat(title = "New Chat"): Promise<Chat> {
  await ensureDirectories()

  const newChat: Chat = {
    id: uuidv4(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await writeJson(path.join(CHATS_DIR, `${newChat.id}.json`), newChat)

  return newChat
}

/** Persist chat changes and bump updatedAt. */
export async function updateChat(chat: Chat): Promise<Chat> {
  chat.updatedAt = new Date().toISOString()

  await writeJson(path.join(CHATS_DIR, `${chat.id}.json`), chat)

  return chat
}

/** Delete a chat file by id. */
export async function deleteChat(id: string): Promise<boolean> {
  try {
    await fs.unlink(path.join(CHATS_DIR, `${id}.json`))
    return true
  } catch (error) {
    console.error(`Error deleting chat ${id}:`, error)
    return false
  }
}

/** Append a message to a chat; derives title from first user message. */
export async function addMessageToChat(
  chatId: string,
  message: Omit<ChatMessage, "id" | "createdAt">,
): Promise<Chat | null> {
  // Don't save empty or undefined content
  if (!message.content || message.content.trim() === "") {
    return null;
  }

  const chat = await getChatById(chatId)
  if (!chat) return null

  const newMessage: ChatMessage = {
    ...message,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  }

  chat.messages.push(newMessage)
  chat.updatedAt = new Date().toISOString()

  // Update chat title if it's the first user message
  if (chat.title === "New Chat" && message.role === "user") {
    chat.title = message.content.slice(0, 50) + (message.content.length > 50 ? "..." : "")
  }

  await updateChat(chat)
  return chat
}

/** Read provider settings (and optional active model/provider) from app_config.json. */
export async function getSettings(): Promise<Settings> {
  try {
    const providers = await readJson<ProviderConfig[]>(SETTINGS_FILE)

    return {
      providers,
    }
  } catch (error) {
    // Return default settings if file doesn't exist
    const defaultSettings: Settings = {
      providers: [],
    }

    return defaultSettings
  }
}

/** Persist provider settings to app_config.json. */
export async function updateSettings(settings: Settings): Promise<Settings> {
  try {
    await writeJson(SETTINGS_FILE, settings.providers)
    return settings
  } catch (error) {
    console.error("Error updating settings:", error)
    throw error
  }
}

