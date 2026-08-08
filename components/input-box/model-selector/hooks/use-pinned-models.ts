"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "pinnedModels"

/**
 * Hook for managing pinned models with localStorage persistence.
 * Uses provider-aware keys: `${provider}:${model_id}`.
 */
export function usePinnedModels() {
  const [pinnedModels, setPinnedModels] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  // Load pinned models from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setPinnedModels(parsed)
        } else {
          console.warn("Invalid pinned models format in localStorage")
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        console.error("Error parsing pinned models from localStorage:", error)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Persist pinned models to localStorage when they change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedModels))
    }
  }, [pinnedModels, mounted])

  /** Toggle pin status of a model. */
  const togglePin = useCallback(
    (provider: string, modelId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation()
      const key = `${provider}:${modelId}`

      setPinnedModels((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key)
        } else {
          return [...prev, key]
        }
      })
    },
    []
  )

  /** Check if a model is pinned. */
  const isPinned = useCallback(
    (provider: string, modelId: string) =>
      pinnedModels.includes(`${provider}:${modelId}`),
    [pinnedModels]
  )

  return {
    pinnedModels,
    mounted,
    togglePin,
    isPinned,
  }
}

export type PinnedModelsHook = ReturnType<typeof usePinnedModels>
