"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChat } from "@/context/chat-context"
import type { DocumentBank } from "@/types/chat"
import { X, Plus, Loader2, Library } from "lucide-react"
import { cn } from "@/lib/utils"
import { DocumentBankRow } from "./row"

interface DocumentBankSidebarProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * DocumentBankSidebar manages persistent document collections.
 * Orchestrates bank CRUD and delegates per-bank rendering to DocumentBankRow.
 */
export function DocumentBankSidebar({ isOpen, onClose }: DocumentBankSidebarProps) {
  const { selectedDocumentBanks, setSelectedDocumentBanks } = useChat()
  const [banks, setBanks] = useState<DocumentBank[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newBankName, setNewBankName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null)
  const [uploadingBankId, setUploadingBankId] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Fetch banks on mount and when sidebar opens
  const fetchBanks = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/document-banks")
      if (res.ok) {
        const data = await res.json()
        setBanks(data)
      }
    } catch (err) {
      console.error("Error fetching banks:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) fetchBanks()
  }, [isOpen, fetchBanks])

  // Create bank
  const handleCreateBank = async () => {
    const name = newBankName.trim()
    if (!name) return
    setIsCreating(true)
    try {
      const res = await fetch("/api/document-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setNewBankName("")
        await fetchBanks()
      }
    } catch (err) {
      console.error("Error creating bank:", err)
    } finally {
      setIsCreating(false)
    }
  }

  // Delete bank
  const handleDeleteBank = async (bankId: string) => {
    try {
      await fetch(`/api/document-banks/${bankId}`, { method: "DELETE" })
      setSelectedDocumentBanks(prev => prev.filter(b => b.id !== bankId))
      await fetchBanks()
    } catch (err) {
      console.error("Error deleting bank:", err)
    }
  }

  // Rename bank
  const handleRename = async (bankId: string, name: string) => {
    try {
      const res = await fetch(`/api/document-banks/${bankId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setSelectedDocumentBanks(prev =>
          prev.map(b => b.id === bankId ? { ...b, name } : b)
        )
        await fetchBanks()
      }
    } catch (err) {
      console.error("Error renaming bank:", err)
    }
  }

  // Toggle bank selection
  const toggleBankSelection = (bank: DocumentBank) => {
    setSelectedDocumentBanks(prev => {
      const isSelected = prev.some(b => b.id === bank.id)
      if (isSelected) {
        return prev.filter(b => b.id !== bank.id)
      }
      return [...prev, { id: bank.id, name: bank.name }]
    })
  }

  // Upload file to bank
  const handleFileUpload = async (bankId: string, files: FileList) => {
    setUploadingBankId(bankId)
    try {
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".pdf")) continue
        const formData = new FormData()
        formData.append("file", file)
        await fetch(`/api/document-banks/${bankId}/files`, {
          method: "POST",
          body: formData,
        })
      }
      await fetchBanks()
    } catch (err) {
      console.error("Error uploading file:", err)
    } finally {
      setUploadingBankId(null)
    }
  }

  // Delete file from bank
  const handleDeleteFile = async (bankId: string, filename: string) => {
    try {
      await fetch(`/api/document-banks/${bankId}/files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      })
      await fetchBanks()
    } catch (err) {
      console.error("Error deleting file:", err)
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 bg-card border-l border-border",
          "transform transition-transform duration-300 ease-in-out",
          "flex flex-col shadow-2xl",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-purple-400" />
            <h2 className="font-semibold text-sm">Document Banks</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Create bank */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder="New bank name..."
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateBank()}
              className="h-8 text-sm bg-background"
            />
            <Button
              size="sm"
              onClick={handleCreateBank}
              disabled={!newBankName.trim() || isCreating}
              className="h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Bank list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && banks.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : banks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              No document banks yet. Create one to get started.
            </p>
          ) : (
            banks.map((bank) => (
              <DocumentBankRow
                key={bank.id}
                bank={bank}
                isSelected={selectedDocumentBanks.some(b => b.id === bank.id)}
                isExpanded={expandedBankId === bank.id}
                isUploading={uploadingBankId === bank.id}
                onToggleSelect={() => toggleBankSelection(bank)}
                onToggleExpand={() => setExpandedBankId(expandedBankId === bank.id ? null : bank.id)}
                onDelete={() => handleDeleteBank(bank.id)}
                onRename={(name) => handleRename(bank.id, name)}
                onUpload={(files) => handleFileUpload(bank.id, files)}
                onDeleteFile={(filename) => handleDeleteFile(bank.id, filename)}
              />
            ))
          )}
        </div>

        {/* Footer showing selected count */}
        {selectedDocumentBanks.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground shrink-0 bg-purple-500/10">
            <span className="text-purple-400 font-medium">{selectedDocumentBanks.length}</span> bank{selectedDocumentBanks.length !== 1 ? "s" : ""} selected for chat context
          </div>
        )}
      </div>
    </>
  )
}
