"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { resolveProviderLogoPath } from "@/lib/model-logos"

interface ProviderTabsProps {
  providers: string[]
  active: string
  onSelect: (provider: string) => void
}

export function ProviderTabs({ providers, active, onSelect }: ProviderTabsProps) {
  return (
    <div className="min-w-[160px] w-[160px] max-w-[160px] flex-none bg-[#1e1f22] border-l border-gray-700 overflow-y-auto">
      {providers.map((provider) => {
        const providerLogoPath = resolveProviderLogoPath(provider)
        return (
          <button
            key={provider}
            className={cn(
              "w-full px-3 py-2.5 text-left text-sm font-medium flex items-center overflow-hidden whitespace-nowrap",
              active === provider ? "bg-[#35373c] text-white" : "text-gray-400 hover:bg-[#2b2d31] hover:text-gray-200"
            )}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect(provider)
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {providerLogoPath && (
              <Image src={providerLogoPath} alt={`${provider} logo`} width={16} height={16} className="mr-2 flex-shrink-0" />
            )}
            <span className="truncate">{provider}</span>
          </button>
        )
      })}
    </div>
  )}


