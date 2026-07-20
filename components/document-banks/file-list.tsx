import { useRef } from "react"
import { Button } from "@/components/ui/button"
import type { DocumentBank } from "@/types/chat"
import { FileText, Loader2, Upload, X } from "lucide-react"

interface DocumentBankFileListProps {
  bank: DocumentBank
  isUploading: boolean
  onUpload: (files: FileList) => void
  onDeleteFile: (filename: string) => void
}

function formatTokens(tokens: number) {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

/**
 * Renders the expanded file list for a single document bank,
 * including per-file details and the upload button.
 */
export function DocumentBankFileList({
  bank,
  isUploading,
  onUpload,
  onDeleteFile,
}: DocumentBankFileListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="px-4 pb-4 pt-2">
      {bank.files.length === 0 ? (
        <p className="py-2 pl-7 text-xs text-muted-foreground">No files yet</p>
      ) : (
        <div className="space-y-2">
          {bank.files.map((file) => (
            <div
              key={file.name}
              className="group/file flex h-9 items-center gap-2 rounded-full bg-muted/40 px-3 transition-colors hover:bg-muted/60"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-purple-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium" title={file.name}>{file.name}</div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatTokens(file.tokens)} t</span>
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400"
                onClick={() => onDeleteFile(file.name)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onUpload(e.target.files)
        }}
      />
      <Button
        variant="ghost"
        className="mt-3 h-8 w-full rounded-full border border-dashed border-border text-xs font-semibold text-foreground hover:bg-muted/30"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Uploading...</>
        ) : (
          <><Upload className="h-3.5 w-3.5 mr-1.5 text-purple-400" /> Add PDF to Bank</>
        )}
      </Button>
    </div>
  )
}
