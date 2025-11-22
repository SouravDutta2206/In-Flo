import type { Settings } from "@/types/chat"

/** Return provider key for model or empty string if not found. */
export function getApiKeyForModel(settings: Settings, modelName: string): string {
  if (!modelName) return ""

  if (settings.activeModel === modelName && settings.activeProvider) {
    const provider = settings.providers.find(
      (p) => p.Provider.toLowerCase() === settings.activeProvider!.toLowerCase()
    )
    return provider?.Key || ""
  }

  for (const provider of settings.providers) {
    const models = (provider.Models || "").split(",").map((m) => m.trim()).filter(Boolean)
    if (models.includes(modelName)) return provider.Key
  }

  return settings.providers[0]?.Key || ""
}

/** Normalize provider name for a given model based on settings; returns a lowercase identifier. */
export function getProviderForModel(settings: Settings, modelName: string): string {
  if (!modelName) return ""

  if (settings.activeModel === modelName && settings.activeProvider) {
    return normalizeProvider(settings.activeProvider)
  }

  for (const provider of settings.providers) {
    const models = (provider.Models || "").split(",").map((m) => m.trim()).filter(Boolean)
    if (models.includes(modelName)) return normalizeProvider(provider.Provider)
  }

  return "No Provider Found"
}

function normalizeProvider(p: string): string {
  const lower = p.toLowerCase()
  if (lower === "google gemini") return "gemini"
  return lower
}


