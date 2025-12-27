"use client"

import { useState, useEffect, useCallback } from "react"
import type { Settings } from "@/types/chat"
import type { Model, ModelResponse, GroupedModels, LogoProvider } from "@/types/models"

/** Provider configuration for fetching models */
interface ProviderConfig {
  name: string
  requiresApiKey: boolean
  settingsKey?: string // Key to look up in settings.providers
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  { name: "Ollama", requiresApiKey: false },
  { name: "OpenRouter", requiresApiKey: false },
  { name: "Groq", requiresApiKey: true, settingsKey: "Groq" },
  { name: "Gemini", requiresApiKey: true, settingsKey: "Gemini" },
]

/**
 * Generic model fetcher for any provider.
 * Handles both GET (no API key) and POST (with API key) requests.
 */
async function fetchModelsFromProvider(
  provider: string,
  apiKey?: string
): Promise<Model[]> {
  const url = `/api/models/${provider.toLowerCase()}`

  try {
    const response = apiKey
      ? await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey }),
        })
      : await fetch(url)

    if (!response.ok) {
      console.warn(`Failed to fetch ${provider} models, proceeding without them.`)
      return []
    }

    const data = await response.json()

    // Handle different response formats (OpenRouter/Groq/Gemini use .data, Ollama uses .models)
    const models = data.data || data.models || []
    return models.map((model: { id?: string; name?: string }) => ({
      name: model.id || model.name || "",
      provider,
    }))
  } catch (error) {
    console.error(`Error fetching ${provider} models:`, error)
    return []
  }
}

/**
 * Hook for fetching models from all providers and managing logo data.
 */
export function useModelFetcher(settings: Settings) {
  const [groupedModels, setGroupedModels] = useState<GroupedModels>({})
  const [isLoading, setIsLoading] = useState(true)
  const [logoMap, setLogoMap] = useState<LogoProvider[]>([])

  // Fetch logo data on mount
  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const response = await fetch("/data/logos.json")
        if (!response.ok) {
          console.warn("Failed to fetch logos.json. Status:", response.status)
          return
        }
        const data = await response.json()
        setLogoMap(data.providers || [])
      } catch (error) {
        console.error("Error fetching logos:", error)
      }
    }
    fetchLogos()
  }, [])

  /** Get API key for a provider from settings */
  const getApiKeyForProvider = useCallback(
    (providerName: string): string | undefined => {
      const provider = settings.providers.find((p) => p.Provider === providerName)
      return provider?.Key || undefined
    },
    [settings.providers]
  )

  /** Load all models from settings and provider APIs. */
  const loadAllModels = useCallback(async () => {
    setIsLoading(true)
    try {
      // Models from settings (non-API providers)
      const settingsModels: Model[] = []
      settings.providers.forEach((provider) => {
        if (provider.Models && provider.Provider !== "OpenRouter") {
          const modelNames = provider.Models.split(",")
            .map((m) => m.trim())
            .filter((name) => name)
          modelNames.forEach((name) => {
            settingsModels.push({ name, provider: provider.Provider })
          })
        }
      })

      // Fetch from all configured providers in parallel
      const fetchPromises = PROVIDER_CONFIGS.map((config) => {
        const apiKey = config.requiresApiKey
          ? getApiKeyForProvider(config.settingsKey || config.name)
          : undefined

        // Skip providers that need API keys but don't have one
        if (config.requiresApiKey && !apiKey) {
          console.warn(`No ${config.name} API key found in settings, skipping.`)
          return Promise.resolve([])
        }

        return fetchModelsFromProvider(config.name, apiKey)
      })

      const results = await Promise.all(fetchPromises)
      const allModels = [...settingsModels, ...results.flat()]

      // Group by provider
      const grouped: GroupedModels = {}
      allModels.forEach((model) => {
        const providerKey = model.provider || "Unknown"
        if (!grouped[providerKey]) {
          grouped[providerKey] = []
        }
        grouped[providerKey].push(model)
      })

      setGroupedModels(grouped)
    } finally {
      setIsLoading(false)
    }
  }, [settings.providers, getApiKeyForProvider])

  // Reload models when settings change
  useEffect(() => {
    loadAllModels()
  }, [loadAllModels])

  /** Get providers that have at least one model. */
  const getProviders = useCallback(() => {
    return Object.keys(groupedModels).filter((p) => groupedModels[p].length > 0)
  }, [groupedModels])

  /** Find provider for the active model. */
  const getActiveModelProvider = useCallback(
    (activeModel?: string) => {
      if (!activeModel) return null
      for (const [provider, models] of Object.entries(groupedModels)) {
        if (models.some((m) => m.name === activeModel)) {
          return provider
        }
      }
      return null
    },
    [groupedModels]
  )

  return {
    groupedModels,
    isLoading,
    logoMap,
    getProviders,
    getActiveModelProvider,
    refetch: loadAllModels,
  }
}

export type ModelFetcherHook = ReturnType<typeof useModelFetcher>
