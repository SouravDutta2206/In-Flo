"use client"

import { useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface Source {
  url: string
  score?: number
  snippet?: string
}

interface SourcesFooterProps {
  sources: Record<string, Source>
}

/**
 * Extracts the domain from a URL string.
 */
export function getDomain(urlString: string): string {
  try {
    const hostname = new URL(urlString).hostname.replace('www.', '')
    const parts = hostname.split('.')
    // For domains like "example.com" or "docs.google.com", get the second-level domain
    if (parts.length >= 2) {
      return parts[parts.length - 2]
    }
    return parts[0] || hostname
  } catch {
    return urlString
  }
}

/**
 * Generates the Google favicon URL for a given domain.
 */
export function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return ''
  }
}

/**
 * SourcesFooter displays a collapsible list of sources as Perplexity-style cards.
 */
export function SourcesFooter({ sources }: SourcesFooterProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const sourceEntries = Object.entries(sources)
  if (sourceEntries.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
        <span className="font-medium">Sources ({sourceEntries.length})</span>
        <ChevronDown 
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {sourceEntries.map(([id, source]) => (
            <SourceCard key={id} id={id} source={source} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface SourceCardProps {
  id: string
  source: Source
}

export function SourceCard({ id, source }: SourceCardProps) {
  const handleClick = () => {
    if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer')
    }
  }

  const domain = getDomain(source.url)
  const snippet = source.snippet?.slice(0, 100) || ''

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex-shrink-0 w-52 py-2 px-3 rounded-xl border border-border/50",
        "bg-muted/30 hover:bg-muted/60 hover:border-border",
        "transition-all duration-200 cursor-pointer text-left",
        "group focus:outline-none focus:ring-2 focus:ring-primary/50"
      )}
    >
      {/* Top row: [n] favicon domain | external link */}
      <div className="flex items-center justify-between h-10">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground font-medium">[{id}]</span>
          <img 
            src={getFaviconUrl(source.url)} 
            alt="" 
            className="h-4 w-4 rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <span className="text-sm text-muted-foreground font-medium capitalize">{domain}</span>
        </div>
        <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      </div>

      {/* Snippet */}
      {snippet && (
        <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-tight mt-1">
          {snippet}
        </p>
      )}
    </button>
  )
}
