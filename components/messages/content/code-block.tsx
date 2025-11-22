"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

/**
 * MarkdownPre wraps fenced code blocks rendered by ReactMarkdown.
 * It displays the detected language and provides a Copy-to-clipboard action.
 */
export function MarkdownPre({ node, ...props }: any) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)
  const [language, setLanguage] = useState("")

  useEffect(() => {
    if (preRef.current) {
      const codeElement = preRef.current.querySelector("code")
      const lang = (codeElement as HTMLElement | null)?.className?.match(/language-(\w+)/)?.[1]
      if (lang) {
        setLanguage(lang)
      }
    }
  }, [])

  const handleCopy = async () => {
    if (preRef.current) {
      const code = preRef.current.textContent
      await navigator.clipboard.writeText(code || "")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="relative group rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
        <div className="text-sm text-zinc-400">{language}</div>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre ref={preRef} {...props} className="!mt-0 !rounded-t-none bg-zinc-950 p-4 overflow-x-auto" />
    </div>
  )
}


