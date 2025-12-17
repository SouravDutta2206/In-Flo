"use client"

import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypePrismPlus from "rehype-prism-plus"
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import "prismjs/themes/prism-tomorrow.css"
import "@/app/globals.css"
import { MarkdownPre } from "@/components/messages/content/code-block"
import { CitationLink } from "@/components/messages/content/citation-link"
import { SourcesFooter } from "@/components/messages/content/sources-footer"
import { useMemo } from "react"

interface MessageContentProps {
  content: string
  isUser: boolean
  sources?: Record<string, { url: string; score?: number; snippet?: string }>
}

/**
 * Normalize Markdown content while preserving code blocks and math delimiters.
 * Converts citation markers [N] to markdown links [N](citation:N) when sources exist.
 */
function normalizeMarkdownContent(text: string, sources?: Record<string, any>): string {
  const codeBlocks: string[] = []
  let processedText = text.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
    codeBlocks.push(match)
    return `___CODE${codeBlocks.length - 1}___`
  })

  const displayMath: string[] = []
  processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula) => {
    displayMath.push(`$$${String(formula).trim()}$$`)
    return `___DISPLAY_MATH${displayMath.length - 1}___`
  })

  const inlineMath: string[] = []
  processedText = processedText.replace(/\$([^$\n]+?)\$|\(\(([^$\n]+?)\)\)/g, (match, formula1, formula2) => {
    const formula = (formula1 || formula2 || "").toString()
    const usesDollar = match.startsWith('$')
    inlineMath.push(usesDollar ? `$${formula.trim()}$` : `\\(${formula.trim()}\\)`)
    return `___INLINE_MATH${inlineMath.length - 1}___`
  })

  // Convert citation markers [N] to links when sources exist
  if (sources && Object.keys(sources).length > 0) {
    processedText = processedText.replace(/\[(\d+)\]/g, (match, id) => {
      return sources[id] ? `[${id}](citation:${id})` : match
    })
  }

  return processedText
    .replace(/___DISPLAY_MATH(\d+)___/g, (_m, index) => `\n\n${displayMath[parseInt(index)]}\n\n`)
    .replace(/___INLINE_MATH(\d+)___/g, (_m, index) => inlineMath[parseInt(index)])
    .replace(/___CODE(\d+)___/g, (_m, index) => codeBlocks[parseInt(index)])
    .trim()
}

const markdownComponents = {
  pre: MarkdownPre,
  code: ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match
    if (isInline) {
      return (
        <code {...props} className="bg-zinc-800 rounded px-1.5 py-0.5">
          {children}
        </code>
      )
    }
    return (
      <code {...props} className={cn(className, "bg-transparent")}>
        {children}
      </code>
    )
  }
}

const remarkPlugins = [remarkGfm, remarkMath] as const
const rehypePlugins: any[] = [
  [rehypePrismPlus, { ignoreMissing: true, showLineNumbers: true }],
  [rehypeKatex, {
    strict: true,
    throwOnError: false,
    trust: true,
    macros: { "\\eqref": "\\href{#1}{}" }
  }]
]

/**
 * MessageContent renders a message with markdown, citations, math, and code blocks.
 * Inline citations [N] show tooltips with source info and link to the source URL.
 */
export function MessageContent({ content, isUser, sources }: MessageContentProps) {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>
  }

  const components = useMemo(() => ({
    ...markdownComponents,
    p: ({ children }: any) => <span className="block mb-4 last:mb-0">{children}</span>,
    a: ({ href, children, ...props }: any) => {
      // Handle citation links with CitationLink component
      if (href?.startsWith('citation:')) {
        const id = href.replace('citation:', '')
        const source = sources?.[id]
        if (source) {
          return <CitationLink id={id} url={source.url} snippet={source.snippet} />
        }
      }
      return <a href={href} {...props}>{children}</a>
    }
  }), [sources])

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={remarkPlugins as any}
        rehypePlugins={rehypePlugins}
        components={components as any}
        urlTransform={(url) => url}
      >
        {normalizeMarkdownContent(content, sources)}
      </ReactMarkdown>
      
      {/* Collapsible sources footer */}
      {sources && Object.keys(sources).length > 0 && (
        <SourcesFooter sources={sources} />
      )}
    </div>
  )
}
