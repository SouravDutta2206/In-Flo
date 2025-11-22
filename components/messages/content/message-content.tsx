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

interface MessageContentProps {
  content: string
  isUser: boolean
}

// Normalize Markdown content while preserving code blocks and math delimiters
function normalizeMarkdownContent(text: string): string {
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

  processedText = processedText
    .replace(/___DISPLAY_MATH(\d+)___/g, (_m, index) => `\n\n${displayMath[parseInt(index)]}\n\n`)
    .replace(/___INLINE_MATH(\d+)___/g, (_m, index) => inlineMath[parseInt(index)])
    .replace(/___CODE(\d+)___/g, (_m, index) => codeBlocks[parseInt(index)])

  return processedText.trim()
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

export function MessageContent({ content, isUser }: MessageContentProps) {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>
  }

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={remarkPlugins as any}
        rehypePlugins={rehypePlugins}
        components={markdownComponents as any}
      >
        {normalizeMarkdownContent(content)}
      </ReactMarkdown>
    </div>
  )
}