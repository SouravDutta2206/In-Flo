"use client"

import { useRef, useState, useEffect } from "react"
import type { FileContext } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { X, FileText, Loader2, ChevronUp, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FileManagerProps {
  files: FileContext[]
  setFiles: (files: FileContext[]) => void
  isUploading: boolean
  setIsUploading: (value: boolean) => void
}

/**
 * FileManager handles PDF file uploads with a dropdown-style file list.
 * Features: multi-file upload, duplicate prevention, clear all button.
 * Styled to match ModelSelector component.
 */
export function FileManager({ files, setFiles, isUploading, setIsUploading }: FileManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setIsUploading(true)
    const newFiles: FileContext[] = []

    try {
      for (const file of Array.from(selectedFiles)) {
        // Skip non-PDF files
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          console.error(`Skipping non-PDF file: ${file.name}`)
          continue
        }

        // Check for duplicates
        const existingNames = [...files, ...newFiles].map(f => f.name.toLowerCase())
        if (existingNames.includes(file.name.toLowerCase())) {
          console.warn(`Skipping duplicate file: ${file.name}`)
          continue
        }

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('http://localhost:8000/api/files/process', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          console.error(`Error processing ${file.name}:`, error.detail)
          continue
        }

        const fileContext: FileContext = await response.json()
        newFiles.push(fileContext)
      }

      if (newFiles.length > 0) {
        setFiles([...files, ...newFiles])
        setIsOpen(true) // Open dropdown to show new files
      }
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const removeFile = (name: string) => {
    const newFiles = files.filter(f => f.name !== name)
    setFiles(newFiles)
    if (newFiles.length === 0) {
      setIsOpen(false)
    }
  }

  const clearAllFiles = () => {
    setFiles([])
    setIsOpen(false)
  }

  const triggerFileSelect = () => {
    inputRef.current?.click()
  }

  // Calculate total tokens
  const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0)
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`
    }
    return tokens.toString()
  }

  const getDisplayText = () => {
    if (files.length === 0) return null // Icon only, no text
    if (files.length === 1) return files[0].name.length > 15 ? files[0].name.slice(0, 12) + '...' : files[0].name
    return `${files.length} files`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Button styled like ModelSelector */}
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={files.length === 0 ? "icon" : "default"}
              className={cn(
                "flex items-center px-2 py-1.5 text-sm rounded-md transition-colors",
                files.length > 0 
                  ? "text-purple-400 bg-transparent hover:bg-muted/80" 
                  : "text-gray-200 bg-transparent hover:bg-muted/80"
              )}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (files.length === 0) {
                  triggerFileSelect()
                } else {
                  setIsOpen(!isOpen)
                }
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  {getDisplayText() && (
                    <span className="ml-2 truncate">{getDisplayText()}</span>
                  )}
                </>
              )}
              {files.length > 0 && (
                <ChevronUp className={cn("h-4 w-4 transition-transform ml-2 flex-shrink-0", !isOpen && "rotate-180")} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="bg-muted text-muted-foreground rounded-xl shadow-lg border border-gray-700 px-3 py-1.5"
          >
            <p>attach documents</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Dropdown styled like ModelSelector */}
      {isOpen && files.length > 0 && (
        <div
          className="absolute bottom-full left-0 mb-1 w-[320px] max-h-[300px] bg-muted text-muted-foreground rounded-xl shadow-lg z-[60] border border-gray-700 flex flex-col overflow-hidden"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-100">
                Documents ({files.length})
              </span>
              <span className="text-xs text-gray-400">
                {formatTokens(totalTokens)} tokens
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-1 text-gray-400 hover:text-red-400"
              onClick={clearAllFiles}
              title="Remove all files"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* File List */}
          <div className="flex-1 overflow-y-auto">
            {files.map((file, index) => (
              <FileRow 
                key={`${file.name}-${index}`} 
                file={file} 
                onRemove={() => removeFile(file.name)} 
              />
            ))}
          </div>
          
          {/* Add More Button */}
          <div className="border-t border-gray-700 p-2">
            <Button
              variant="ghost"
              className="w-full justify-center px-4 py-2 text-sm text-gray-200 hover:bg-[#35373c] rounded-md"
              onClick={triggerFileSelect}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Add More PDFs
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface FileRowProps {
  file: FileContext
  onRemove: () => void
}

function FileRow({ file, onRemove }: FileRowProps) {
  // Truncate filename if too long
  const displayName = file.name.length > 35 
    ? file.name.slice(0, 32) + '...' 
    : file.name

  // Format token count
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`
    }
    return tokens.toString()
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between w-full px-4 py-3 text-left text-sm cursor-default group",
        "hover:bg-[#35373c]"
      )}
    >
      <div className="flex items-center overflow-hidden mr-2">
        <FileText className="h-4 w-4 text-purple-400 mr-2 flex-shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-gray-100 truncate" title={file.name}>
            {displayName}
          </div>
          <div className="text-xs text-gray-400">
            {formatTokens(file.tokens)} tokens
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-400"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
