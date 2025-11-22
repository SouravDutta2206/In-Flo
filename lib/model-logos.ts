import { LogoProvider } from "@/types/models"

/**
 * Resolve a logo asset path for a given model and/or provider.
 * Prefers dynamic entries from logos.json, falls back to known providers.
 */
export function resolveModelLogoPath(name: string, provider?: string, logoMap: LogoProvider[] = []): string | null {
  const lowerName = name?.toLowerCase() || ""
  const lowerProvider = provider?.toLowerCase() || ""

  // Try dynamic mapping from logos.json first
  for (const lp of logoMap) {
    if (lowerName.includes(lp.name.toLowerCase())) {
      const raw = lp.path.startsWith("public/") ? lp.path.substring("public/".length) : lp.path
      return raw.startsWith("/") ? raw : `/${raw}`
    }
  }

  // Fallbacks based on provider
  if (lowerProvider.includes("google") || lowerProvider.includes("gemini")) return "/google.svg"
  if (lowerProvider.includes("ollama")) return "/ollama.svg"
  if (lowerProvider.includes("huggingface")) return "/huggingface.svg"
  if (lowerProvider.includes("openrouter")) return "/openrouter.svg"
  if (lowerProvider.includes("groq")) return "/groq.svg"

  return null
}

/**
 * Resolve a logo asset path for a provider name.
 */
export function resolveProviderLogoPath(provider: string): string | null {
  const lower = provider.toLowerCase()
  if (lower.includes("google") || lower.includes("gemini")) return "/google.svg"
  if (lower.includes("ollama")) return "/ollama.svg"
  if (lower.includes("huggingface")) return "/huggingface.svg"
  if (lower.includes("openrouter")) return "/openrouter.svg"
  if (lower.includes("groq")) return "/groq.svg"
  return null
}


