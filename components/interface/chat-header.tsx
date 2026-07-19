"use client"

import { Button } from "@/components/ui/button"
import { Menu, Trash2, Library } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { useState, useEffect } from "react"
import { useChat } from "@/context/chat-context"

interface ChatHeaderProps {
  toggleSidebar: () => void
  sidebarOpen: boolean
  toggleBankSidebar: () => void
  bankSidebarOpen: boolean
}

/**
 * ChatHeader shows the conversation title, a mobile sidebar toggle, bank sidebar toggle, and a delete action.
 */
export function ChatHeader({ toggleSidebar, sidebarOpen, toggleBankSidebar, bankSidebarOpen }: ChatHeaderProps) {
  const isMobile = useMobile()
  const { currentChat, deleteCurrentChat, selectedDocumentBanks } = useChat()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Return a simple div with the same structure while not mounted
  if (!mounted) {
    return <div className="h-16 border-b border-border flex items-center px-4" />
  }

  return (
    <div className="h-12 flex items-center justify-between px-6 border-b border-border shrink-0 bg-background transition-colors">
      <div className="flex items-center flex-shrink-0 min-w-0">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2 flex-shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h2 className="font-semibold truncate max-w-[200px] md:max-w-md">{currentChat?.title || "New Chat"}</h2>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleBankSidebar}
          title="Document Banks"
          className={`flex-shrink-0 relative ${bankSidebarOpen ? 'text-purple-400' : ''}`}
        >
          <Library className="h-4 w-4" />
          {selectedDocumentBanks.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-purple-600 text-[10px] text-white flex items-center justify-center font-medium">
              {selectedDocumentBanks.length}
            </span>
          )}
        </Button>
        {currentChat && (
          <Button variant="ghost" size="icon" onClick={deleteCurrentChat} title="Delete conversation" className="flex-shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
