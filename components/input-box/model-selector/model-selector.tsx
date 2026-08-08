"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  Search,
  Type,
  Image as ImageIcon,
  Video,
  Mic,
} from "lucide-react"
import { useChat } from "@/context/chat-context"
import { cn } from "@/lib/utils"
import Image from "next/image"
import type { Model } from "@/types/models"
import { resolveProviderLogoPath } from "@/lib/model-logos"
import { useModelFetcher } from "@/components/input-box/model-selector/hooks/use-model-fetcher"
import { usePinnedModels } from "@/components/input-box/model-selector/hooks/use-pinned-models"

/** Format lowercase provider keys for the UI. */
function getProviderDisplayName(provider: string): string {
  const mapping: Record<string, string> = {
    gemini: "Gemini",
    groq: "Groq",
    ollama: "Ollama",
    openrouter: "OpenRouter",
  }
  return mapping[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

/** Render a capability icon by modality name. */
function CapabilityIcon({ cap, size = 14 }: { cap: string; size?: number }) {
  switch (cap) {
    case "text":
      return <Type size={size} />
    case "image":
      return <ImageIcon size={size} />
    case "video":
      return <Video size={size} />
    case "audio":
      return <Mic size={size} />
    default:
      return null
  }
}

/**
 * ModelSelector — split flyout design.
 *
 * The flyout DOM is always mounted (never conditionally rendered) so opening
 * is instant — just a CSS visibility toggle, no DOM creation on click.
 */
export function ModelSelector() {
  const { settings, updateChatSettings } = useChat()
  const [open, setOpen] = useState(false)
  const [activeProvider, setActiveProvider] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { groupedModels, getProviders, getActiveModelProvider, fetchIfStale } =
    useModelFetcher(settings)
  const { mounted, isPinned, togglePin } = usePinnedModels()

  // Derive selected model from settings — no local state needed
  const selectedModelId = settings.activeModel || ""

  const providers = useMemo(() => getProviders(), [getProviders])

  // Resolve display name for the trigger button
  const displayName = useMemo(() => {
    if (!selectedModelId) return "Choose Model"
    for (const models of Object.values(groupedModels)) {
      const m = models.find((m) => m.model_id === selectedModelId)
      if (m) return m.name
    }
    return selectedModelId
  }, [selectedModelId, groupedModels])

  // Resolve which provider tab should be active
  const resolvedProvider = useMemo(() => {
    if (providers.length === 0) return ""
    const current = getActiveModelProvider(settings.activeModel)
    if (current && groupedModels[current]) return current
    return providers[0]
  }, [providers, settings.activeModel, getActiveModelProvider, groupedModels])

  // Sync activeProvider when models load (so it's set before first open)
  useEffect(() => {
    if (resolvedProvider) {
      setActiveProvider(resolvedProvider)
    }
  }, [resolvedProvider])

  // Open/close handler
  const handleToggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        fetchIfStale()
        setActiveProvider(resolvedProvider)
        setSearchTerm("")
        // Focus search input after the CSS transition makes it visible
        requestAnimationFrame(() => {
          searchInputRef.current?.focus()
        })
      }
      return next
    })
  }, [fetchIfStale, resolvedProvider])

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  // Filter models for active provider — memoized
  const { pinned, regular, total } = useMemo(() => {
    if (!activeProvider || !groupedModels[activeProvider])
      return { pinned: [] as Model[], regular: [] as Model[], total: 0 }

    const term = searchTerm.toLowerCase()
    const filtered = groupedModels[activeProvider].filter(
      (model) =>
        model.name.toLowerCase().includes(term) ||
        model.model_id.toLowerCase().includes(term)
    )

    const pinnedModels = filtered
      .filter((model) => isPinned(model.provider, model.model_id))
      .sort((a, b) => a.name.localeCompare(b.name))

    const regularModels = filtered.filter(
      (model) => !isPinned(model.provider, model.model_id)
    )

    return { pinned: pinnedModels, regular: regularModels, total: filtered.length }
  }, [activeProvider, groupedModels, searchTerm, isPinned])

  /** Select a model and persist in chat settings. */
  const handleSelectModel = useCallback(
    (model: Model) => {
      updateChatSettings({
        ...settings,
        activeModel: model.model_id,
        activeProvider: model.provider,
      })
      setOpen(false)
    },
    [settings, updateChatSettings]
  )

  /** Stable toggle-pin handler for ModelItem. */
  const handleTogglePin = useCallback(
    (provider: string, modelId: string, e?: React.MouseEvent) => {
      togglePin(provider, modelId, e)
    },
    [togglePin]
  )

  if (!mounted) {
    return null
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 text-sm font-medium transition-colors",
          open
            ? "text-gray-200"
            : "text-gray-300 hover:text-white"
        )}
        onClick={handleToggleOpen}
      >
        <span className="truncate max-w-[150px] text-left">{displayName}</span>
        <ChevronDown size={14} className="text-gray-500" />
      </button>

      {/*
        Flyout panel — ALWAYS in the DOM.
        Visibility is toggled via CSS (opacity + pointer-events + transform).
        This avoids the cost of creating 100+ DOM nodes on every open.
      */}
      <div
        className={cn(
          "absolute bottom-full mb-4 left-0 w-[calc(100vw-32px)] sm:w-[500px] md:w-[600px] shadow-2xl flex flex-col rounded-xl overflow-hidden z-50 border bg-[#2f2f2f] border-[#424242] transition-[opacity,transform] duration-150",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
        onMouseDown={(e) => {
          if (!(e.target instanceof HTMLInputElement)) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 p-4 border-b border-[#424242]">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filter by model name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-gray-200 placeholder-gray-500"
          />
        </div>

        {/* Body split */}
        <div className="flex h-[340px]">
          {/* Left column: Providers */}
          <div className="w-40 shrink-0 border-r border-[#424242] bg-[#212121] flex flex-col">
            <div className="flex-1 overflow-y-auto py-2">
              {providers.map((provider) => {
                const providerLogo = resolveProviderLogoPath(provider)
                return (
                  <button
                    key={provider}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-sm transition-colors",
                      activeProvider === provider
                        ? "bg-[#2f2f2f] text-white font-medium"
                        : "text-gray-400 hover:text-white hover:bg-[#2f2f2f]/50"
                    )}
                    onClick={() => {
                      setActiveProvider(provider)
                      setSearchTerm("")
                    }}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {providerLogo && (
                        <Image
                          src={providerLogo}
                          alt={`${provider} logo`}
                          width={16}
                          height={16}
                          className="flex-shrink-0"
                        />
                      )}
                      <span className="truncate">{getProviderDisplayName(provider)}</span>
                    </span>
                    {activeProvider === provider && (
                      <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right column: Models */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Section header */}
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b border-[#424242] text-gray-500 bg-[#2f2f2f] flex-shrink-0">
              {getProviderDisplayName(activeProvider)} Models
              {total > 0 && (
                <span className="ml-2 text-gray-600 normal-case font-normal">
                  ({total})
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Pinned section */}
              {pinned.length > 0 && (
                <>
                  <div className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Pinned
                  </div>
                  {pinned.map((model, i) => (
                    <ModelItem
                      key={`pinned-${model.provider}-${model.model_id}-${i}`}
                      model={model}
                      isSelected={selectedModelId === model.model_id}
                      isPinned={true}
                      onSelect={handleSelectModel}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                  {regular.length > 0 && (
                    <div className="h-px bg-[#424242] my-1 mx-5" />
                  )}
                </>
              )}

              {/* Regular section */}
              {regular.map((model, i) => (
                <ModelItem
                  key={`regular-${model.provider}-${model.model_id}-${i}`}
                  model={model}
                  isSelected={selectedModelId === model.model_id}
                  isPinned={false}
                  onSelect={handleSelectModel}
                  onTogglePin={handleTogglePin}
                />
              ))}

              {total === 0 && searchTerm && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No models match your search.
                </div>
              )}
              {total === 0 && !searchTerm && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No models available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Individual model item in the list — memoized to skip re-renders for unchanged rows. */
const ModelItem = React.memo(function ModelItem({
  model,
  isSelected,
  isPinned,
  onSelect,
  onTogglePin,
}: {
  model: Model
  isSelected: boolean
  isPinned: boolean
  onSelect: (model: Model) => void
  onTogglePin: (provider: string, modelId: string, e?: React.MouseEvent) => void
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSelect(model)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "w-full text-left px-5 py-3 border-b transition-colors group flex items-start justify-between border-[#424242] cursor-pointer focus:outline-none focus:bg-[#3d3d3d]",
        isSelected ? "bg-[#3d3d3d]" : "hover:bg-[#3d3d3d]"
      )}
      onClick={() => onSelect(model)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex-1 min-w-0">
        {/* Model display name */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-200 truncate">
            {model.name}
          </span>
        </div>
        {/* Monospace model_id */}
        <div className="font-mono text-[11px] text-gray-500 truncate">
          {model.model_id}
        </div>
      </div>

      {/* Right side: capabilities + pin */}
      <div className="flex items-start gap-3 shrink-0 ml-4 mt-0.5">
        {/* Capability icons */}
        <div className="flex flex-col gap-1 items-end">
          {/* Inputs row */}
          {model.capabilities?.input?.length > 0 && (
            <div
              className="flex gap-1.5"
              title={`Inputs: ${model.capabilities.input.join(", ")}`}
            >
              {model.capabilities.input.map((cap) => (
                <div key={`in-${cap}`} className="text-blue-400/80">
                  <CapabilityIcon cap={cap} />
                </div>
              ))}
            </div>
          )}
          {/* Outputs row */}
          {model.capabilities?.output?.length > 0 && (
            <div
              className="flex gap-1.5"
              title={`Outputs: ${model.capabilities.output.join(", ")}`}
            >
              {model.capabilities.output.map((cap) => (
                <div key={`out-${cap}`} className="text-emerald-400/80">
                  <CapabilityIcon cap={cap} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pin button */}
        <button
          className={cn(
            "p-1 rounded-sm transition-all",
            isPinned
              ? "text-blue-400 opacity-100 hover:text-blue-300"
              : "text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-300"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(model.provider, model.model_id, e)
          }}
          aria-label={isPinned ? "Unpin model" : "Pin model"}
        >
          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      </div>
    </div>
  )
})
