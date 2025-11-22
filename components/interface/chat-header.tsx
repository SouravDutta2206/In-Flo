"use client"

import { Button } from "@/components/ui/button"
import { Menu, Trash2 } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { useState, useEffect } from "react"
import { useChat } from "@/context/chat-context"

interface ChatHeaderProps {
  toggleSidebar: () => void
  sidebarOpen: boolean
}

/**
 * ChatHeader shows the conversation title, a mobile sidebar toggle, and a delete action.
 */
export function ChatHeader({ toggleSidebar, sidebarOpen }: ChatHeaderProps) {
  const isMobile = useMobile()
  const { currentChat, deleteCurrentChat } = useChat()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Return a simple div with the same structure while not mounted
  if (!mounted) {
    return <div className="h-16 border-b border-border flex items-center px-4" />
  }

  return (
    <div className="sticky top-0 z-50 h-16 bg-background border-b border-border flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center flex-shrink-0 min-w-0">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2 flex-shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h2 className="font-semibold truncate max-w-[200px] md:max-w-md">{currentChat?.title || "New Chat"}</h2>
      </div>

      <div className="flex items-center flex-shrink-0">
        {currentChat && (
          <Button variant="ghost" size="icon" onClick={deleteCurrentChat} title="Delete conversation" className="flex-shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

