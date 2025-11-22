"use client"

import { useRef, useEffect, useState } from "react"
import type { ChatMessage } from "@/types/chat"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Copy, Loader2, Check, Pencil, Trash2, Brain, Cpu, Gauge, Clock } from "lucide-react"
import { format } from "date-fns"
import { MessageContent } from "@/components/messages/content/message-content"
import { useChat } from "@/context/chat-context"
import { EditMessageInput } from "@/components/input-box/edit-message-input"

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
}

/**
 * MessageList renders the chat transcript, supports copy/edit/delete actions, and manages scroll.
 */
export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { editAndResendMessage, deleteMessagePair, currentChat } = useChat()
  const [mounted, setMounted] = useState(false)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const scrollLockRef = useRef(false)

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initial scroll
  useEffect(() => {
    if (mounted && messages.length > 0) {
      scrollToBottom()
    }
  }, [mounted, messages.length])

  // Scroll on updates unless user scrolled up
  useEffect(() => {
    if (!scrollLockRef.current && messagesEndRef.current) {
      scrollToBottom()
    }
  }, [messages, isLoading])

  // Handle scroll events to determine if user has scrolled up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100
    scrollLockRef.current = !isAtBottom
  }

  // Return a simple div with the same structure while not mounted
  if (!mounted) {
    return <div className="flex-1" />
  }

  return (
    <div className="flex-1 p-4 space-y-6 pb-40 pr-0" onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Start a new conversation</h3>
            <p className="text-muted-foreground">Type a message below to begin</p>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <div 
            key={message.id} 
            className={cn(
              "flex flex-col",
              message.role === "user" ? "items-end" : "items-start" 
            )}
          >
            <div
              className={cn(
                "max-w-[100%] bg-muted text-white rounded-xl px-4 py-2 break-words",
                message.role === "user" 
                  ? editingMessageId === message.id 
                    ? "w-full"
                    : "max-w-[60%]"
                  : "w-full bg-transparent"
              )}
              onMouseEnter={() => setHoveredMessageId(message.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {editingMessageId === message.id ? (
                <EditMessageInput 
                  initialContent={message.content}
                  messageId={message.id}
                  onSave={(id: string, newContent: string) => {
                    editAndResendMessage(id, newContent)
                    setEditingMessageId(null)
                  }}
                  onCancel={() => setEditingMessageId(null)}
                />
              ) : (
                <MessageContent content={message.content} isUser={message.role === "user"} />
              )}
              {editingMessageId !== message.id && (
                <div className="flex flex-col gap-1 mt-4">
                  <div className="text-xs opacity-100 text-muted-foreground">{format(new Date(message.createdAt), "HH:mm")}</div>
                  {message.role === "assistant" && (
                    <div className="text-xs text-muted-foreground opacity-100 mt-2 flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Brain className="h-3 w-3" />
                        <span>{message.model} ({message.provider || 'unknown'})</span>
                      </div>
                      <span>|</span>
                      <div className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        <span>{Math.ceil(message.content.length / 4)} tokens</span>
                      </div>
                      {message.duration && (
                        <>
                          <span>.</span>
                          <div className="flex items-center gap-1">
                            <Gauge className="h-3 w-3" />
                            <span>{(Math.ceil(message.content.length / 4) / (message.duration / 1000)).toFixed(1)} tokens/sec</span>
                          </div>
                          <span>.</span>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{(message.duration / 1000).toFixed(1)}s Time-to-finish</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className={cn("flex items-center mt-1 space-x-1")}> 
              <MessageActions
                role={message.role}
                isHovered={hoveredMessageId === message.id}
                isCopied={copiedMessageId === message.id}
                onCopy={() => {
                  if (!navigator.clipboard) return
                  navigator.clipboard.writeText(message.content)
                  setCopiedMessageId(message.id)
                  setTimeout(() => setCopiedMessageId(null), 1000)
                }}
                onEdit={() => setEditingMessageId(message.id)}
                onDelete={() => deleteMessagePair(message.id)}
              />
            </div>
          </div>
        ))
      )}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted max-w-[80%] rounded-xl px-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

function MessageActions({
  role,
  isHovered,
  isCopied,
  onCopy,
  onEdit,
  onDelete,
}: {
  role: "user" | "assistant" | "system"
  isHovered: boolean
  isCopied: boolean
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "z-50 h-10 w-10 rounded-xl opacity-0 hover:opacity-100 hover:bg-muted transition-opacity duration-200",
          isHovered || isCopied ? "opacity-100" : "opacity-0",
          role === "assistant" ? "ml-3" : ""
        )}
        onClick={onCopy}
      >
        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>

      {role === "user" && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "z-50 h-10 w-10 rounded-xl opacity-0 hover:opacity-100 hover:bg-muted transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "z-50 h-10 w-10 rounded-xl opacity-0 hover:opacity-100 hover:bg-muted transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-0"
        )}
        onClick={onDelete}
        title="Delete Message Pair"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  )
}


