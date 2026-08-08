"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Settings } from "@/types/chat"
import type { Model, ModelsResponse, GroupedModels } from "@/types/models"

/** How long (ms) before cached models are considered stale. */
const STALE_MS = 60_000

/**
 * Hook for fetching models from the aggregate backend endpoint.
 * Uses lazy fetching — models are only loaded when `fetchIfStale()` is called
 * (typically on popover open) and cached for STALE_MS.
 */
export function useModelFetcher(settings: Settings) {
  const [groupedModels, setGroupedModels] = useState<GroupedModels>({})
  const [isLoading, setIsLoading] = useState(false)
  const lastFetchRef = useRef<number>(0)

  /** Extract API keys from settings to pass to the aggregate endpoint. */
  const getApiKeys = useCallback(() => {
    const keys: { groq_api_key?: string; gemini_api_key?: string } = {}

    for (const provider of settings.providers) {
      if (provider.Provider === "Groq" && provider.Key) {
        keys.groq_api_key = provider.Key
      }
      if (provider.Provider === "Gemini" && provider.Key) {
        keys.gemini_api_key = provider.Key
      }
    }

    return keys
  }, [settings.providers])

  /** Load all models via the single aggregate endpoint. */
  const loadAllModels = useCallback(async () => {
    setIsLoading(true)
    try {
      const apiKeys = getApiKeys()

      // Single aggregate fetch
      let fetchedModels: Model[] = []
      try {
        const response = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiKeys),
        })

        if (response.ok) {
          const data: ModelsResponse = await response.json()
          fetchedModels = data.data || []
        } else {
          console.warn("Failed to fetch aggregate models, proceeding with settings models only.")
        }
      } catch (error) {
        console.error("Error fetching aggregate models:", error)
      }

      // Merge in manual settings models as fallback rich records
      const settingsModels: Model[] = []
      settings.providers.forEach((provider) => {
        if (provider.Models && provider.Provider !== "OpenRouter") {
          const modelNames = provider.Models.split(",")
            .map((m) => m.trim())
            .filter((name) => name)
          modelNames.forEach((name) => {
            settingsModels.push({
              name,
              model_id: name,
              provider: provider.Provider.toLowerCase(),
              capabilities: { input: ["text"], output: ["text"] },
            })
          })
        }
      })

      // Combine and deduplicate by provider:model_id
      const allModels = [...fetchedModels, ...settingsModels]
      const seen = new Set<string>()
      const deduped: Model[] = []
      for (const model of allModels) {
        const normalizedProvider = model.provider.toLowerCase()
        const key = `${normalizedProvider}:${model.model_id}`
        if (!seen.has(key)) {
          seen.add(key)
          deduped.push({
            ...model,
            provider: normalizedProvider,
          })
        }
      }

      // Group by provider
      const grouped: GroupedModels = {}
      deduped.forEach((model) => {
        const providerKey = model.provider
        if (!grouped[providerKey]) {
          grouped[providerKey] = []
        }
        grouped[providerKey].push(model)
      })

      setGroupedModels(grouped)
      lastFetchRef.current = Date.now()
    } finally {
      setIsLoading(false)
    }
  }, [settings.providers, getApiKeys])

  // Eager-fetch on mount and when settings change, so data is ready before user clicks
  useEffect(() => {
    loadAllModels()
  }, [loadAllModels])

  /** Fetch models only if data is absent or stale. */
  const fetchIfStale = useCallback(async () => {
    const isEmpty = Object.keys(groupedModels).length === 0
    const isStale = Date.now() - lastFetchRef.current > STALE_MS
    if (isEmpty || isStale) {
      await loadAllModels()
    }
  }, [loadAllModels, groupedModels])

  /** Get providers that have at least one model. */
  const getProviders = useCallback(() => {
    return Object.keys(groupedModels).filter((p) => groupedModels[p].length > 0)
  }, [groupedModels])

  /** Find provider for the active model (matches by model_id). */
  const getActiveModelProvider = useCallback(
    (activeModel?: string) => {
      if (!activeModel) return null
      for (const [provider, models] of Object.entries(groupedModels)) {
        if (models.some((m) => m.model_id === activeModel)) {
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
    getProviders,
    getActiveModelProvider,
    fetchIfStale,
    refetch: loadAllModels,
  }
}

export type ModelFetcherHook = ReturnType<typeof useModelFetcher>
