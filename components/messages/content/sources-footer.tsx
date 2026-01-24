"use client"

import { useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ExternalLink, FileText } from "lucide-react"
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
 * Checks if a source URL is a file reference (not a web URL).
 */
function isFileSource(url: string): boolean {
  return !url.startsWith('http://') && !url.startsWith('https://')
}

/**
 * Parses a file source URL like "document.pdf#page=3" into filename and page.
 */
function parseFileSource(url: string): { filename: string; page?: number } {
  const [filename, fragment] = url.split('#')
  const pageMatch = fragment?.match(/page=(\d+)/)
  return {
    filename,
    page: pageMatch ? parseInt(pageMatch[1], 10) : undefined
  }
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
  const isFile = isFileSource(source.url)
  const fileInfo = isFile ? parseFileSource(source.url) : null
  
  const handleClick = () => {
    // Only open external links for web sources
    if (!isFile && source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer')
    }
  }

  const domain = isFile ? fileInfo?.filename : getDomain(source.url)
  const snippet = source.snippet?.slice(0, 100) || ''

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex-shrink-0 w-52 py-2 px-3 rounded-xl border border-border/50",
        "bg-muted/30 hover:bg-muted/60 hover:border-border",
        "transition-all duration-200 text-left",
        isFile ? "cursor-default" : "cursor-pointer",
        "group focus:outline-none focus:ring-2 focus:ring-primary/50"
      )}
    >
      {/* Top row: [n] icon domain/filename | external link */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden flex-1">
          <span className="text-sm text-muted-foreground font-medium flex-shrink-0">[{id}]</span>
          {isFile ? (
            <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
          ) : (
            <img 
              src={getFaviconUrl(source.url)} 
              alt="" 
              className="h-4 w-4 rounded-sm flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <span className="text-sm text-muted-foreground font-medium truncate">
            {domain}
          </span>
        </div>
        {!isFile && (
          <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
        )}
      </div>

      {/* Page number for file sources - displayed separately */}
      {isFile && fileInfo?.page && (
        <div className="flex items-center gap-1 mt-1 ml-6">
          <span className="text-xs font-medium text-purple-400">Page {fileInfo.page}</span>
        </div>
      )}

      {/* Snippet */}
      {snippet && (
        <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-tight mt-1">
          {snippet}
        </p>
      )}
    </button>
  )
}

