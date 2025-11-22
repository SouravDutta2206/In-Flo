import { Code, Sparkles, Book, Compass } from "lucide-react"
import { Button } from "../ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface WelcomeScreenProps {
  onSentenceClick: (sentence: string) => void;
}

export function WelcomeScreen({ onSentenceClick }: WelcomeScreenProps) {
  const [activeButton, setActiveButton] = useState<string | null>(null);

  const handleButtonClick = (buttonId: string) => {
    setActiveButton(activeButton === buttonId ? null : buttonId);
  };

  const handleSentenceClick = (sentence: string) => {
    onSentenceClick(sentence);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden px-4">
      <div className="text-center space-y-8 max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-left">How can I help you?</h1>
        
        {/* Action buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            variant={activeButton === "Create" ? "default" : "outline"} 
            className={cn(
              "flex flex-row items-center justify-center h-12 gap-2",
              activeButton === "Create" && "bg-primary text-primary-foreground"
            )}
            onClick={() => handleButtonClick("Create")}
          >
            <Sparkles className="h-6 w-6" />
            <span>Create</span>
          </Button>
          <Button 
            variant={activeButton === "Explore" ? "default" : "outline"} 
            className={cn(
              "flex flex-row items-center justify-center h-12 gap-2",
              activeButton === "Explore" && "bg-primary text-primary-foreground"
            )}
            onClick={() => handleButtonClick("Explore")}
          >
            <Compass className="h-6 w-6" />
            <span>Explore</span>
          </Button>
          <Button 
            variant={activeButton === "Code" ? "default" : "outline"} 
            className={cn(
              "flex flex-row items-center justify-center h-12 gap-2",
              activeButton === "Code" && "bg-primary text-primary-foreground"
            )}
            onClick={() => handleButtonClick("Code")}
          >
            <Code className="h-6 w-6" />
            <span>Code</span>
          </Button>
          <Button 
            variant={activeButton === "Learn" ? "default" : "outline"} 
            className={cn(
              "flex flex-row items-center justify-center h-12 gap-2",
              activeButton === "Learn" && "bg-primary text-primary-foreground"
            )}
            onClick={() => handleButtonClick("Learn")}
          >
            <Book className="h-6 w-6" />
            <span>Learn</span>
          </Button>
        </div>

        {/* Example questions */}
        {(!activeButton || activeButton !== "Create" && activeButton !== "Explore" && activeButton !== "Code" && activeButton !== "Learn") && (
          <div id="Default" className="space-y-4 text-left">
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Say hello to the AI")}
            >
              Say hello to the AI
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("What is the capital of France?")}
            >
              What is the capital of France?
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick('How many Rs are in the word "strawberry"?')}
            >
              How many Rs are in the word "strawberry"?
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("What is the meaning of life?")}
            >
              What is the meaning of life?
            </p>
          </div>
        )}
        {activeButton === "Create" && (
          <div id="Create" className="space-y-4 text-left">
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Write a short story about a group of heroes saving the world from a powerful villain")}
            >
              Write a short story about a group of heroes saving the world from a powerful villain
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Help me outline a sci-fi novel set in a futuristic city inside a computer")}
            >
              Help me outline a sci-fi novel set in a futuristic city inside a computer
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Create a character profile for a villain with malicious motives")}
            >
              Create a character profile for a villain with malicious motives
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Give me 5 ideas for a illustration for a children's book")}
            >
              Give me 5 ideas for a illustration for a children's book
            </p>
          </div>
        )}
        {activeButton === "Explore" && (
          <div id="Explore" className="space-y-4 text-left">
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Good Books for fans of Witcher")}
            >
              Good Books for fans of Witcher
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Countries ranked for best quality of life")}
            >
              Countries ranked for best quality of life
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Top 3 richest companies in the world")}
            >
              Top 3 richest companies in the world
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("How much money do I need to retire?")}
            >
              How much money do I need to retire?
            </p>
          </div>
        )}
        {activeButton === "Code" && (
          <div id="Code" className="space-y-4 text-left">
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("How to create a simple calculator in Python")}
            >
              How to create a simple calculator in Python
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Difference between .sort() and sorted() in Python")}
            >
              Difference between .sort() and sorted() in Python
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Explain shallow copy and deep copy in Python")}
            >
              Explain shallow copy and deep copy in Python
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Explain difference between threading, asyncio and multiprocessing in Python")}
            >
              Explain difference between threading, asyncio and multiprocessing in Python
            </p>
          </div>
        )}
        {activeButton === "Learn" && (
          <div id="Learn" className="space-y-4 text-left">
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Beginners guide to Python")}
            >
              Beginners guide to Python
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Beginners guide to machine learning with Python")}
              >
              Beginners guide to machine learning with Python
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("Why is AI models hard to train?")}
            >
              Why is AI models hard to train?
            </p>
            <p 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => handleSentenceClick("How does the internet work?")}
            >
              How does the internet work?
            </p>
          </div>
        )}
      </div>
    </div>
  )
}