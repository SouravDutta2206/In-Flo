"use client"

import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface EditMessageInputProps {
  initialContent: string
  messageId: string
  onSave: (messageId: string, newContent: string) => void
  onCancel: () => void
}

/**
 * EditMessageInput allows inline editing of a user message with keyboard shortcuts.
 */
export function EditMessageInput({
  initialContent,
  messageId,
  onSave,
  onCancel,
}: EditMessageInputProps) {
  const [editText, setEditText] = useState(initialContent)

  // Ensure textarea focuses when the component mounts (edit mode starts)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
    // Initial resize on mount
    handleInput();
  }, [])

  const handleSave = () => {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === initialContent) return
    onSave(messageId, trimmed)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSave()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  // Auto-resize the textarea height to fit content
  const handleInput = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value)
  }

  return (
    <div className="space-y-2 w-full">
      <Textarea
        ref={textareaRef}
        value={editText}
        onChange={handleChange}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="w-full resize-none overflow-y-auto bg-muted border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-2 rounded-xl max-h-40"
        rows={2}
      />
      <div className="flex justify-end space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={!editText.trim() || editText.trim() === initialContent}
        >
          Save & Submit
        </Button>
      </div>
    </div>
  )
} 