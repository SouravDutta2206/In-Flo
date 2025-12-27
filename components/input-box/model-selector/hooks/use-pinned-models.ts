"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Hook for managing pinned models with localStorage persistence.
 */
export function usePinnedModels() {
  const [pinnedModels, setPinnedModels] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  // Load pinned models from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const storedPinnedModels = localStorage.getItem("pinnedModels")
    if (storedPinnedModels) {
      try {
        const parsedModels = JSON.parse(storedPinnedModels)
        if (Array.isArray(parsedModels)) {
          setPinnedModels(parsedModels)
        } else {
          console.warn("Invalid pinned models format in localStorage")
          localStorage.removeItem("pinnedModels")
        }
      } catch (error) {
        console.error("Error parsing pinned models from localStorage:", error)
        localStorage.removeItem("pinnedModels")
      }
    }
  }, [])

  // Persist pinned models to localStorage when they change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("pinnedModels", JSON.stringify(pinnedModels))
    }
  }, [pinnedModels, mounted])

  /** Toggle pin status of a model. */
  const togglePin = useCallback((modelName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    setPinnedModels((prev) => {
      if (prev.includes(modelName)) {
        return prev.filter((name) => name !== modelName)
      } else {
        return [...prev, modelName]
      }
    })
  }, [])

  /** Check if a model is pinned. */
  const isPinned = useCallback(
    (modelName: string) => pinnedModels.includes(modelName),
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
