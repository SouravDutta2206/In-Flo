"use client"

import { useState } from "react"
import { ChevronDown, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
  thinkingDuration?: number
}

export function ThinkingBlock({ thinking, isStreaming = false, thinkingDuration }: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!thinking) return null

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger 
        className={cn(
          "relative flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors group py-1.5 rounded-lg overflow-hidden",
          isStreaming && "text-foreground"
        )}
      >
        {/* Moving gradient background during streaming */}
        {isStreaming && (
          <div 
            className="absolute inset-0 -z-10 animate-gradient-x rounded-lg"
            style={{
              background: "linear-gradient(90deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.3) 25%, rgba(236,72,153,0.2) 50%, rgba(168,85,247,0.3) 75%, rgba(99,102,241,0.2) 100%)",
              backgroundSize: "200% 100%",
            }}
          />
        )}
        <Lightbulb className={cn("h-5 w-5", isStreaming && "animate-pulse text-purple-400")} />
        <span className="font-medium">Thoughts{isStreaming ? "..." : ""}</span>
        {thinkingDuration && !isStreaming && (
          <span className="text-muted-foreground">
            {formatDuration(thinkingDuration)}
          </span>
        )}
        <ChevronDown 
          className={cn(
            "h-5 w-5 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div 
          className={cn(
            "relative px-4 py-3 rounded-xl border border-zinc-800 text-muted-foreground whitespace-pre-wrap text-sm overflow-hidden",
            isStreaming ? "bg-transparent" : "bg-zinc-900/50"
          )}
        >
          {/* Animated gradient background during streaming */}
          {isStreaming && (
            <div 
              className="absolute inset-0 -z-10 animate-gradient-x"
              style={{
                background: "linear-gradient(90deg, rgba(39,39,42,0.5) 0%, rgba(63,63,70,0.5) 25%, rgba(39,39,42,0.5) 50%, rgba(63,63,70,0.5) 75%, rgba(39,39,42,0.5) 100%)",
                backgroundSize: "200% 100%",
              }}
            />
          )}
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
