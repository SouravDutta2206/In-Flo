"use client"

import { Code, Sparkles, Book, Compass, type LucideIcon } from "lucide-react"
import { Button } from "../ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"

// Data-driven prompt suggestions by category
const PROMPT_CATEGORIES: Record<string, string[]> = {
  Default: [
    "Say hello to the AI",
    "What is the capital of France?",
    'How many Rs are in the word "strawberry"?',
    "What is the meaning of life?",
  ],
  Create: [
    "Write a short story about a group of heroes saving the world from a powerful villain",
    "Help me outline a sci-fi novel set in a futuristic city inside a computer",
    "Create a character profile for a villain with malicious motives",
    "Give me 5 ideas for a illustration for a children's book",
  ],
  Explore: [
    "Good Books for fans of Witcher",
    "Countries ranked for best quality of life",
    "Top 3 richest companies in the world",
    "How much money do I need to retire?",
  ],
  Code: [
    "How to create a simple calculator in Python",
    "Difference between .sort() and sorted() in Python",
    "Explain shallow copy and deep copy in Python",
    "Explain difference between threading, asyncio and multiprocessing in Python",
  ],
  Learn: [
    "Beginners guide to Python",
    "Beginners guide to machine learning with Python",
    "Why is AI models hard to train?",
    "How does the internet work?",
  ],
}

// Category button configuration
const CATEGORY_BUTTONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: "Create", icon: Sparkles, label: "Create" },
  { id: "Explore", icon: Compass, label: "Explore" },
  { id: "Code", icon: Code, label: "Code" },
  { id: "Learn", icon: Book, label: "Learn" },
]

interface SuggestionItemProps {
  text: string
  onClick: (text: string) => void
}

function SuggestionItem({ text, onClick }: SuggestionItemProps) {
  return (
    <p
      className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      onClick={() => onClick(text)}
    >
      {text}
    </p>
  )
}

interface WelcomeScreenProps {
  onSentenceClick: (sentence: string) => void
}

export function WelcomeScreen({ onSentenceClick }: WelcomeScreenProps) {
  const [activeButton, setActiveButton] = useState<string | null>(null)

  const handleButtonClick = (buttonId: string) => {
    setActiveButton(activeButton === buttonId ? null : buttonId)
  }

  const activeCategory = activeButton || "Default"
  const prompts = PROMPT_CATEGORIES[activeCategory] || PROMPT_CATEGORIES.Default

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden px-4">
      <div className="text-center space-y-8 max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-left">How can I help you?</h1>

        {/* Category buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORY_BUTTONS.map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              variant={activeButton === id ? "default" : "outline"}
              className={cn(
                "flex flex-row items-center justify-center h-12 gap-2",
                activeButton === id && "bg-primary text-primary-foreground"
              )}
              onClick={() => handleButtonClick(id)}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </Button>
          ))}
        </div>

        {/* Prompt suggestions */}
        <div className="space-y-4 text-left">
          {prompts.map((prompt) => (
            <SuggestionItem key={prompt} text={prompt} onClick={onSentenceClick} />
          ))}
        </div>
      </div>
    </div>
  )
}