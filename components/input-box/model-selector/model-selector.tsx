"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronUp, Pin, PinOff } from "lucide-react"
import { useChat } from "@/context/chat-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import type { Model } from "@/types/models"
import { resolveModelLogoPath } from "@/lib/model-logos"
import { SearchBar } from "@/components/input-box/model-selector/SearchBar"
import { ProviderTabs } from "@/components/input-box/model-selector/ProviderTabs"
import { useModelFetcher } from "@/components/input-box/model-selector/hooks/use-model-fetcher"
import { usePinnedModels } from "@/components/input-box/model-selector/hooks/use-pinned-models"

/**
 * ModelSelector lets users choose a model across providers, with search and pinning.
 */
export function ModelSelector() {
  const { settings, updateChatSettings } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Use extracted hooks
  const { groupedModels, logoMap, getProviders, getActiveModelProvider } = useModelFetcher(settings)
  const { mounted, isPinned, togglePin } = usePinnedModels()

  // Initialize selection and tab based on settings
  useEffect(() => {
    const providers = getProviders()

    if (providers.length > 0) {
      const currentProvider = getActiveModelProvider(settings.activeModel)
      if (currentProvider && groupedModels[currentProvider]) {
        setActiveTab(currentProvider)
      } else {
        setActiveTab(providers[0])
      }
    }

    if (settings.activeModel) {
      const modelExists = Object.values(groupedModels)
        .flat()
        .some((model) => model.name === settings.activeModel)
      if (modelExists) {
        setSelectedModel(settings.activeModel)
      } else {
        setSelectedModel("")
        const providers = getProviders()
        if (providers.length > 0) {
          setActiveTab(providers[0])
        }
      }
    }
  }, [settings.activeModel, groupedModels, getProviders, getActiveModelProvider])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  /** Select a model and persist in chat settings. */
  const handleSelectModel = (model: Model) => {
    setSelectedModel(model.name)
    updateChatSettings({
      ...settings,
      activeModel: model.name,
      activeProvider: model.provider,
    })
    setIsOpen(false)
  }

  const renderModelItem = (model: Model, index: number) => {
    const logoPath = resolveModelLogoPath(model.name, model.provider, logoMap)
    const pinned = isPinned(model.name)

    return (
      <div
        key={`${model.provider}-${model.name}-${index}`}
        role="button"
        tabIndex={0}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 text-left text-sm cursor-pointer group",
          selectedModel === model.name ? "bg-[#3f4146]" : "hover:bg-[#35373c]"
        )}
        onClick={() => handleSelectModel(model)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleSelectModel(model)
          }
        }}
      >
        <div className="flex items-center overflow-hidden mr-2">
          {logoPath && (
            <Image
              src={logoPath}
              alt={`${model.name} logo`}
              width={16}
              height={16}
              className="mr-2 flex-shrink-0"
            />
          )}
          <div className="font-medium text-gray-100 truncate">{model.name}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 p-1 text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100",
            pinned && "opacity-100 text-blue-400 hover:text-blue-300",
            !pinned && "hover:text-gray-200"
          )}
          onClick={(e) => togglePin(model.name, e)}
          aria-label={pinned ? "Unpin model" : "Pin model"}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
      </div>
    )
  }

  if (!mounted) {
    return null
  }

  const providers = getProviders()

  // Filter and sort models for current tab
  const getFilteredModels = () => {
    if (!activeTab || !groupedModels[activeTab]) return { pinned: [], regular: [] }

    const filtered = groupedModels[activeTab].filter((model) =>
      model.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const pinned = filtered
      .filter((model) => isPinned(model.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    const regular = filtered.filter((model) => !isPinned(model.name))

    return { pinned, regular, total: filtered.length }
  }

  const { pinned, regular, total } = getFilteredModels()

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Button to show selected model and toggle dropdown */}
      <Button
        variant="ghost"
        className="flex w-full justify-between px-2 py-1.5 ml-2 mb-1 text-sm text-gray-200 bg-transparent hover:bg-muted/80 rounded-md transition-colors"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <span className="truncate ml-2">{selectedModel || "Choose Model"}</span>
        <ChevronUp className={cn("h-4 w-4 transition-transform mr-2 flex-shrink-0", !isOpen && "rotate-180")} />
      </Button>

      {/* Dropdown with Tabs */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 right-0 ml-2 mb-1 w-[600px] h-[400px] bg-muted text-muted-foreground rounded-xl shadow-lg z-[60] border border-gray-700 flex overflow-hidden"
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          onClick={(e) => {
            if (!(e.target instanceof HTMLInputElement)) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          {/* Left Side: Search + Model List */}
          <div className="flex-1 min-w-0 flex flex-col bg-muted">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />

            <div className="flex-1 overflow-y-auto">
              {activeTab && groupedModels[activeTab] ? (
                <>
                  {pinned.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Pinned
                      </div>
                      {pinned.map(renderModelItem)}
                      {regular.length > 0 && <div className="h-px bg-gray-700 my-2 mx-4" />}
                    </>
                  )}
                  {regular.length > 0 && (
                    <>
                      {pinned.length > 0 && (
                        <div className="px-4 pt-1 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Models
                        </div>
                      )}
                      {regular.map(renderModelItem)}
                    </>
                  )}
                  {total === 0 && searchTerm && (
                    <div className="p-4 text-center text-gray-400">No models match your search.</div>
                  )}
                </>
              ) : (
                <div className="p-4 text-center text-gray-400">Select a provider tab.</div>
              )}
            </div>
          </div>

          {/* Right Side: Provider Tabs */}
          <ProviderTabs
            providers={providers}
            active={activeTab}
            onSelect={(p) => {
              setActiveTab(p)
              setSearchTerm("")
            }}
          />
        </div>
      )}
    </div>
  )
}
