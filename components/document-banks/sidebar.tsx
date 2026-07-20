"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useChat } from "@/context/chat-context"
import type { DocumentBank } from "@/types/chat"
import { X, Plus, Loader2, Library, Info } from "lucide-react"
import { isPdfFile } from "@/lib/utils"
import { toast } from "sonner"
import { DocumentBankRow } from "./row"

interface DocumentBankSidebarProps {
  isOpen: boolean
  onClose: () => void
}

/** Wrapper around fetch that throws on non-OK responses and shows a toast. */
async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
  errorLabel = "Request failed",
): Promise<T | null> {
  try {
    const res = await fetch(url, init)
    if (!res.ok) {
      toast.error(`${errorLabel}: ${res.statusText}`)
      return null
    }
    // Some endpoints (DELETE) return 204 with no body
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : (null as unknown as T)
  } catch (err) {
    toast.error(`${errorLabel}: ${err instanceof Error ? err.message : "Network error"}`)
    return null
  }
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
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null)
  const [uploadingBankId, setUploadingBankId] = useState<string | null>(null)

  // Fetch banks on mount and when sidebar opens
  const fetchBanks = useCallback(async () => {
    setIsLoading(true)
    const data = await apiFetch<DocumentBank[]>(
      "/api/document-banks",
      undefined,
      "Failed to load document banks",
    )
    if (data) setBanks(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (isOpen) fetchBanks()
  }, [isOpen, fetchBanks])

  // Create bank
  const handleCreateBank = async () => {
    const name = newBankName.trim()
    if (!name) return
    setIsCreating(true)
    const result = await apiFetch(
      "/api/document-banks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
      "Failed to create bank",
    )
    if (result !== null) {
      setNewBankName("")
      setIsCreateOpen(false)
      await fetchBanks()
    }
    setIsCreating(false)
  }

  // Delete bank
  const handleDeleteBank = async (bankId: string) => {
    const result = await apiFetch(
      `/api/document-banks/${bankId}`,
      { method: "DELETE" },
      "Failed to delete bank",
    )
    if (result !== null) {
      setSelectedDocumentBanks(prev => prev.filter(b => b.id !== bankId))
      await fetchBanks()
    }
  }

  // Rename bank
  const handleRename = async (bankId: string, name: string) => {
    const result = await apiFetch(
      `/api/document-banks/${bankId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
      "Failed to rename bank",
    )
    if (result !== null) {
      setSelectedDocumentBanks(prev =>
        prev.map(b => b.id === bankId ? { ...b, name } : b)
      )
      await fetchBanks()
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
    for (const file of Array.from(files)) {
      if (!isPdfFile(file)) continue
      const formData = new FormData()
      formData.append("file", file)
      await apiFetch(
        `/api/document-banks/${bankId}/files`,
        { method: "POST", body: formData },
        `Failed to upload ${file.name}`,
      )
    }
    await fetchBanks()
    setUploadingBankId(null)
  }

  // Delete file from bank
  const handleDeleteFile = async (bankId: string, filename: string) => {
    const result = await apiFetch(
      `/api/document-banks/${bankId}/files/${encodeURIComponent(filename)}`,
      { method: "DELETE" },
      `Failed to delete ${filename}`,
    )
    if (result !== null) {
      await fetchBanks()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        className="w-80 p-0 flex flex-col bg-card border-l border-border shadow-2xl [&>button:last-of-type]:hidden"
      >
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between h-16 px-4 border-b border-border shrink-0 space-y-0">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-purple-400" />
            <SheetTitle className="font-semibold text-xl tracking-normal">Document Banks</SheetTitle>
          </div>
          <SheetDescription className="sr-only">Manage your document bank collections</SheetDescription>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Create bank */}
          <div className="px-4 py-4 border-b border-border">
            {isCreateOpen ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">New Document Bank</h3>
                <Input
                  placeholder="Bank Name (e.g. Finance)"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateBank()}
                  className="h-8 rounded-full border-border bg-background/50 px-4 text-sm"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-3 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewBankName("")
                      setIsCreateOpen(false)
                    }}
                    className="h-8 px-2 text-sm font-semibold hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateBank}
                    disabled={!newBankName.trim() || isCreating}
                    className="h-8 rounded-full bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="h-10 w-full rounded-full bg-purple-600 text-sm font-semibold text-white hover:bg-purple-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Document Bank
              </Button>
            )}
          </div>

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

        <div className="shrink-0 border-t border-border bg-card">
          <div className="px-4 pb-2 pt-2 text-xs text-muted-foreground">
            <span className="font-medium text-purple-400">{selectedDocumentBanks.length}</span> active bank{selectedDocumentBanks.length !== 1 ? "s" : ""}
          </div>
          <div className="flex gap-3 border-t border-border px-4 py-4 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
            <p>
              Check a bank to make its document collection active for subsequent prompts in the current chat. Active banks will be queried semantically.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
