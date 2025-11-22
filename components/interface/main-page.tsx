"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/interface/sidebar"
import { ChatHeader } from "@/components/interface/chat-header"
import { MessageList } from "@/components/messages/message-list"
import { WelcomeScreen } from "@/components/interface/welcome-screen"
import { useMobile } from "@/hooks/use-mobile"
import { useChat } from "@/context/chat-context"
import { ChatInput } from "@/components/input-box/chat-input"

/**
 * ChatInterface composes the overall layout: sidebar, header, message list, and input.
 */
export default function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMobile = useMobile()
  const { currentChat, isLoading } = useChat()

  // Toggle the sidebar on mobile
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  // Prefill the input when clicking a suggested sentence
  const handleSentenceClick = (sentence: string) => {
    setInput(sentence);
  };

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Return a simple div with the same structure while not mounted
  if (!mounted) {
    return <div className="flex h-screen bg-background" />
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:z-0`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="z-40 flex flex-col flex-1 h-full overflow-y-auto">
        <ChatHeader toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

        <div className="flex-1 flex flex-col items-center relative bg-background pb-8">
          <div className="w-full max-w-7xl h-full flex flex-col px-4">
            {!currentChat ? (
              <WelcomeScreen onSentenceClick={handleSentenceClick} />
            ) : (
              <MessageList 
                key={currentChat.id} 
                messages={currentChat?.messages || []} 
                isLoading={isLoading || isSubmitting} 
              />
            )}
          </div>
        </div>

        <ChatInput 
          input={input}
          setInput={setInput}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
        />
      </div>
    </div>
  )
}

