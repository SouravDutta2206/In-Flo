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
    <div className="bg-muted/20 px-3 pb-2">
      {bank.files.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 pl-8">No files yet</p>
      ) : (
        bank.files.map((file) => (
          <div
            key={file.name}
            className="flex items-center gap-2 py-1.5 pl-8 pr-1 group/file hover:bg-muted/30 rounded"
          >
            <FileText className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs truncate" title={file.name}>{file.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {formatTokens(file.tokens)} tokens · {file.chunks} chunks
              </div>
            </div>
            <Button
              variant="ghost" size="icon"
              className="h-5 w-5 opacity-0 group-hover/file:opacity-100 hover:text-red-400 shrink-0"
              onClick={() => onDeleteFile(file.name)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))
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
        className="w-full mt-1 h-7 text-xs text-muted-foreground hover:text-foreground justify-start pl-8"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Uploading...</>
        ) : (
          <><Upload className="h-3 w-3 mr-1.5" /> Upload PDFs</>
        )}
      </Button>
    </div>
  )
}
