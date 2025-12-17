"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SourceCard } from "./sources-footer"

interface CitationLinkProps {
  id: string
  url: string
  snippet?: string
}

/**
 * CitationLink renders an inline citation marker [N] with a tooltip showing the source.
 * Clicking opens the URL in a new tab.
 */
export function CitationLink({ id, url, snippet }: CitationLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="link"
            tabIndex={0}
            className="text-muted-foreground hover:text-primary cursor-pointer transition-colors"
            onClick={handleClick}
            onKeyDown={(e) => e.key === 'Enter' && handleClick(e as any)}
          >
            [{id}]
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="p-0 border border-border/50 rounded-xl"
        >
          <SourceCard id={id} source={{ url, snippet }} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
