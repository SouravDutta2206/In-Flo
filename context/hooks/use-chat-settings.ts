"use client"

import { useState, useEffect, useCallback } from "react"
import type { Settings } from "@/types/chat"
import { getSettings, updateSettings as persistSettings } from "@/app/actions/chat-actions"
import { getApiKeyForModel as _getApiKeyForModel, getProviderForModel as _getProviderForModel } from "@/lib/settings"

// Local storage key for caching settings
const SETTINGS_CACHE_KEY = "chat_app_settings"

/**
 * Hook for managing application settings (providers, API keys, active model).
 * Handles persistence to both localStorage (cache) and server-side storage (file).
 */
export function useChatSettings() {
  const [settings, setSettings] = useState<Settings>({ providers: [] })
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load settings on mount from localStorage or server
  const loadSettings = useCallback(async () => {
    // Try localStorage cache first
    const cachedSettings = localStorage.getItem(SETTINGS_CACHE_KEY)
    if (cachedSettings) {
      try {
        setSettings(JSON.parse(cachedSettings))
        setIsInitialized(true)
        return
      } catch (error) {
        console.error("Error parsing cached settings:", error)
      }
    }

    // Fallback to server-side settings
    const fileSettings = await getSettings()
    setSettings(fileSettings)
    setIsInitialized(true)
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  /** Update settings in storage and cache, then update state. */
  const updateChatSettings = useCallback(async (newSettings: Settings) => {
    try {
      // Save to server
      await persistSettings(newSettings)
      // Save to localStorage cache
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(newSettings))
      setSettings(newSettings)
    } catch (error) {
      console.error("Error updating settings:", error)
    }
  }, [])

  /** Resolve an API key for the given model from settings. */
  const getApiKeyForModel = useCallback(
    (modelName: string): string => _getApiKeyForModel(settings, modelName),
    [settings]
  )

  /** Find provider identifier for a given model name based on settings. */
  const getProviderForModel = useCallback(
    (modelName: string): string => _getProviderForModel(settings, modelName),
    [settings]
  )

  /** Get Tavily API key for web search. */
  const getTavilyKey = useCallback(
    (): string => settings.providers.find(p => p.Provider === "Tavily")?.Key || "",
    [settings]
  )

  return {
    settings,
    isSearchMode,
    setIsSearchMode,
    isInitialized,
    updateChatSettings,
    getApiKeyForModel,
    getProviderForModel,
    getTavilyKey,
  }
}

export type ChatSettingsHook = ReturnType<typeof useChatSettings>
