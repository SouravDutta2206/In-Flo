"use client"

import { useState, type FormEvent, type KeyboardEvent, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/input-box/model-selector/model-selector"
import { useChat } from "@/context/chat-context"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, Square, SearchIcon } from "lucide-react"

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
}

/**
 * ChatInput manages the message text area, keyboard shortcuts, model selection, and send/stop actions.
 */
export function ChatInput({ input, setInput, isSubmitting, setIsSubmitting }: ChatInputProps) {
  const { sendMessage, currentChat, stopInference, isGenerating, isSearchMode, setIsSearchMode } = useChat()
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [originalInput, setOriginalInput] = useState<string | null>(null)

  const userMessages = currentChat?.messages.filter(m => m.role === 'user').reverse() ?? [];

  // Submit on Enter (without Shift) or form submit
  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const trimmed = input.trim()
    if (!trimmed || isSubmitting) return

    setInput("")
    setIsSubmitting(true)
    setHistoryIndex(-1)
    setOriginalInput(null)

    try {
      await sendMessage(trimmed)
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Keyboard shortcuts: Alt+Up/Down navigate previous user prompts; Enter submits; Shift+Enter newline
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      if (userMessages.length === 0) return
      if (historyIndex === -1) setOriginalInput(input)
      const nextIndex = Math.min(historyIndex + 1, userMessages.length - 1)
      if (nextIndex >= 0) {
        setInput(userMessages[nextIndex].content)
        setHistoryIndex(nextIndex)
      }
      return
    }

    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > -1) {
        const nextIndex = historyIndex - 1
        if (nextIndex >= 0) {
          setInput(userMessages[nextIndex].content)
          setHistoryIndex(nextIndex)
        } else {
          setInput(originalInput ?? '')
          setHistoryIndex(-1)
          setOriginalInput(null)
        }
      }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Keep input state in sync with textarea
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  return (
    <div className="fixed bottom-0 right-0 z-10 w-full md:w-[calc(100%-256px)] bg-gradient-to-t from-background to-transparent py-4">
      <div className="w-full max-w-5xl mx-auto px-4">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex flex-col bg-background border border-border rounded-xl shadow-lg p-2 relative">
            <div className="flex flex-col space-y-2">
              <Textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here... (Shift+Enter for new line)"
                className="w-full min-h-[40px] max-h-[200px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent resize-none text-lg"
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-between max-w-[25%] gap-1">
                  <div className="w-full">
                    <ModelSelector />
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSearchMode(!isSearchMode)}
                      className={`w-full justify-between px-2 py-1.5 ml-2 mb-1 text-sm rounded-md transition-colors ${
                        isSearchMode 
                          ? 'text-muted bg-white hover:bg-white hover:text-muted' 
                          : 'text-gray-200 bg-transparent hover:bg-muted/80'
                      }`}
                    >
                      <span className="flex items-center">
                        <SearchIcon className="mr-2 h-4 w-4" />
                        Web Search
                      </span>
                    </Button>
                  </div>
                </div>
                <div>
                      {isGenerating ? (
                        <Button 
                          type="button" 
                        size="icon"
                        onClick={stopInference}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button 
                        type="submit" 
                        size="icon"
                        disabled={isSubmitting || !input.trim()}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                      >
                        <ArrowUp/>
                      </Button>
                    )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
} 