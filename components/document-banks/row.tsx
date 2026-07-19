import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import type { DocumentBank } from "@/types/chat"
import {
  X, Trash2, ChevronRight, ChevronDown, Pencil, Check,
} from "lucide-react"
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

/**
 * Renders a single document bank row with expand/collapse,
 * inline rename, selection checkbox, and action buttons.
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

  return (
    <div className="border-b border-border/50">
      {/* Bank row */}
      <div className="flex items-center gap-2 px-3 py-2.5 group hover:bg-muted/30 transition-colors">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="shrink-0 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
        />

        <button
          onClick={onToggleExpand}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </button>

        {isEditing ? (
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitRename()}
              className="h-6 text-xs bg-background"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={commitRename}>
              <Check className="h-3 w-3 text-green-400" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cancelEditing}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
            <div className="text-sm font-medium truncate">{bank.name}</div>
            <div className="text-xs text-muted-foreground">
              {bank.files.length} file{bank.files.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={startEditing}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6 hover:text-red-400"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
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
