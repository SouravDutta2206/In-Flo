import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DocumentBank } from "@/types/chat"
import {
  X, Trash2, ChevronDown, Pencil, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DocumentBankFileList } from "./file-list"

interface DocumentBankRowProps {
  bank: DocumentBank
  isSelected: boolean
  isExpanded: boolean
  isUploading: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onDelete: () => void
  onRename: (name: string) => Promise<void>
  onUpload: (files: FileList) => void
  onDeleteFile: (filename: string) => void
}

function formatTokens(tokens: number) {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

/**
 * Renders a single document bank row with expand/collapse,
 * inline rename, active selection, and action buttons.
 * Editing state is fully local to the row.
 */
export function DocumentBankRow({
  bank,
  isSelected,
  isExpanded,
  isUploading,
  onToggleSelect,
  onToggleExpand,
  onDelete,
  onRename,
  onUpload,
  onDeleteFile,
}: DocumentBankRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingName, setEditingName] = useState("")

  const startEditing = () => {
    setEditingName(bank.name)
    setIsEditing(true)
  }

  const commitRename = async () => {
    const name = editingName.trim()
    if (!name) return
    await onRename(name)
    setIsEditing(false)
  }

  const cancelEditing = () => setIsEditing(false)
  const tokenCount = bank.files.reduce((total, file) => total + file.tokens, 0)

  return (
    <div className="border-b border-border/50">
      {/* Bank row */}
      <div className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/20">
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={isSelected ? "Deactivate document bank" : "Activate document bank"}
          className={cn(
            "h-4 w-4 shrink-0 rounded-full border transition-colors",
            isSelected
              ? "border-purple-400 bg-purple-500 shadow-[0_0_0_3px_rgba(168,85,247,0.18)]"
              : "border-purple-500 hover:border-purple-300"
          )}
        />
        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitRename()}
              className="h-8 rounded-full bg-background text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={commitRename}>
              <Check className="h-3 w-3 text-green-400" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelEditing}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggleExpand}>
            <div className="truncate text-sm font-semibold">{bank.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {bank.files.length} file{bank.files.length !== 1 ? "s" : ""} &bull; {formatTokens(tokenCount)} tokens
            </div>
          </button>
        )}

        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={startEditing}
              title="Rename bank"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400"
              onClick={onDelete}
              title="Delete bank"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onToggleExpand}
              title={isExpanded ? "Collapse bank" : "Expand bank"}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isExpanded && "-rotate-90")} />
            </Button>
          </div>
        )}
      </div>

      {/* Expanded file list */}
      {isExpanded && (
        <DocumentBankFileList
          bank={bank}
          isUploading={isUploading}
          onUpload={onUpload}
          onDeleteFile={onDeleteFile}
        />
      )}
    </div>
  )
}
