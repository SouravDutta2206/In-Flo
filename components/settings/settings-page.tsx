"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import type { Settings, ProviderConfig } from "@/types/chat"
import { ArrowLeft, Save, Download, Plus, Trash2, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { updateSettings, getSettings } from "@/app/actions/chat-actions"
import { useChat } from "@/context/chat-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Local storage key
const SETTINGS_CACHE_KEY = "chat_app_settings"

// Add this right after the SETTINGS_CACHE_KEY constant
const getModelList = (models: string): string[] => {
  return models ? models.split(',').filter(model => model.trim()) : [];
}

export default function SettingsPage() {
  const { updateChatSettings } = useChat()
  const [settings, setSettings] = useState<Settings>({
    providers: [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const router = useRouter()
  const [pullModelName, setPullModelName] = useState("")
  const [isPulling, setIsPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState(0)
  const [activeTab, setActiveTab] = useState("api-keys")
  
  // New state for model inputs
  const [huggingfaceModelInput, setHuggingfaceModelInput] = useState("")
  const [geminiModelInput, setGeminiModelInput] = useState("")

  // Load settings from cache or file on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Try to load from localStorage first
      const cachedSettings = localStorage.getItem(SETTINGS_CACHE_KEY)

      if (cachedSettings) {
        try {
          setSettings(JSON.parse(cachedSettings))
          return
        } catch (error) {
          console.error("Error parsing cached settings:", error)
        }
      }

      // If no cache or error parsing, load from file
      try {
        const fileSettings = await getSettings()
        setSettings(fileSettings)
      } catch (error) {
        console.error("Error loading settings from file:", error)
      }
    }

    loadSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage("")

    try {
      // Save to file
      await updateSettings(settings)

      // Save to localStorage
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings))

      // Update the chat context with the new settings
      // This will trigger the model selector to update
      updateChatSettings(settings)

      setSaveMessage("Settings saved successfully!")
    } catch (error) {
      console.error("Error saving settings:", error)
      setSaveMessage("Error saving settings")
    } finally {
      setIsSaving(false)

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage("")
      }, 3000)
    }
  }

  const updateProviderConfig = (provider: string, field: keyof ProviderConfig, value: string) => {
    setSettings((prev) => {
      const providers = [...prev.providers]
      const index = providers.findIndex((p) => p.Provider === provider)

      if (index >= 0) {
        providers[index] = { ...providers[index], [field]: value }
      } else {
        providers.push({
          Provider: provider,
          Key: field === "Key" ? value : "",
          Models: field === "Models" ? value : "",
        })
      }

      return { ...prev, providers }
    })
  }

  const getProviderConfig = (provider: string): ProviderConfig => {
    const config = settings.providers.find((p) => p.Provider === provider)
    return config || { Provider: provider, Key: "", Models: "" }
  }

  const handlePullModel = async () => {
    if (!pullModelName.trim()) return;
    
    setIsPulling(true);
    setPullProgress(0);
    
    try {
      const response = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: pullModelName.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pull model');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let currentDigestDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const part = JSON.parse(line);
            if (part.digest) {
              if (part.completed && part.total) {
                const percent = Math.round((part.completed / part.total) * 100);
                setPullProgress(percent);
                if (percent === 100 && !currentDigestDone) {
                  currentDigestDone = true;
                } else {
                  currentDigestDone = false;
                }
              }
            } else {
              console.log(part.status);
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }

      toast.success(`Model ${pullModelName} has been pulled successfully`);
    } catch (error: any) {
      console.error('Error pulling model:', error);
      toast.error(`Failed to pull model: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsPulling(false);
      setPullProgress(0);
      setPullModelName("");
    }
  };

  const saveSettingsToSystem = async (newSettings: Settings) => {
    try {
      await updateSettings(newSettings)
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(newSettings))
      updateChatSettings(newSettings)
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings")
    }
  }

  const handleAddModel = async (provider: string, modelName: string) => {
    if (!modelName.trim()) return;
    
    const currentConfig = getProviderConfig(provider);
    const currentModels = getModelList(currentConfig.Models);
    
    if (currentModels.includes(modelName.trim())) {
      toast.error(`Model ${modelName} already exists`);
      return;
    }
    
    const newModels = [...currentModels, modelName.trim()].join(',');
    const newSettings = {
      ...settings,
      providers: settings.providers.map(p => 
        p.Provider === provider ? { ...p, Models: newModels } : p
      )
    };
    
    await saveSettingsToSystem(newSettings);
    setSettings(newSettings);
    
    // Clear input
    if (provider === "HuggingFace") {
      setHuggingfaceModelInput("");
    } else if (provider === "Gemini") {
      setGeminiModelInput("");
    }
    
    toast.success(`Added model ${modelName}`);
  }

  const handleRemoveModel = async (provider: string, modelName: string) => {
    const currentConfig = getProviderConfig(provider);
    const currentModels = getModelList(currentConfig.Models);
    const newModels = currentModels.filter(model => model !== modelName).join(',');
    
    const newSettings = {
      ...settings,
      providers: settings.providers.map(p => 
        p.Provider === provider ? { ...p, Models: newModels } : p
      )
    };
    
    await saveSettingsToSystem(newSettings);
    setSettings(newSettings);

    if (provider === "HuggingFace") {
      setHuggingfaceModelInput("");
    } else if (provider === "Gemini") {
      setGeminiModelInput("");
    }

    toast.success(`Removed model ${modelName}`);
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => router.push("/")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="api-keys" onValueChange={setActiveTab} className="h-full">
        <TabsList className="mb-4" >
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="Pull Models">Pull Models</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="h-full">

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Configure API Keys for different AI providers and add models to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Ollama Section */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Ollama</h3>
                <p className="text-sm text-muted-foreground">
                  Ollama should be installed on the system. The app will automatically detect installed models.
                </p>
              </div>

              {/* HuggingFace Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">HuggingFace Inference API Key</h3>

                <div className="flex flex-col space-y-4">
                  <Label htmlFor="huggingface-key">Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="huggingface-key"
                      type="password"
                      value={getProviderConfig("HuggingFace").Key}
                      onChange={(e) => updateProviderConfig("HuggingFace", "Key", e.target.value)}
                      placeholder="hf_abc...."
                      className="rounded-xl flex-1 max-w-[80%]"
                    />
                    <Button 
                      onClick={handleSave} disabled={isSaving}
                      className="w-[20%] min-w-[100px] rounded-xl hover:bg-gray-300"
                    >
                      {isSaving ? (
                        <span className="flex items-center">
                          Saving
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="huggingface-models">Models</Label>
                  <div className="flex space-x-2">
                    <div className="flex-1 flex space-x-2">
                      <Input
                        id="huggingface-models"
                        type="text"
                        value={huggingfaceModelInput}
                        onChange={(e) => setHuggingfaceModelInput(e.target.value)}
                        placeholder="author/model-name"
                        className="rounded-xl"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className='rounded-xl hover:bg-gray-300 w-12'
                                  size="icon"
                                  disabled={getModelList(getProviderConfig("HuggingFace").Models).length === 0}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="flex flex-1 flex-col bottom-full left-0 right-0 w-fit max-h-[400px] bg-[#35373c] rounded-xl shadow-lg border-gray-600 justify-center overflow-hidden">
                        {getModelList(getProviderConfig("HuggingFace").Models).map((model) => (
                            <DropdownMenuItem
                              className="flex flex-1 cursor-pointer bg-[#35373c] hover:bg-[#3f4146] overflow-y-auto truncate rounded-xl group w-full px-4 py-2"
                              key={model}
                              onClick={() => setHuggingfaceModelInput(model)}
                            >
                              {model}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Button
                      onClick={() => handleAddModel("HuggingFace", huggingfaceModelInput)}
                      size="icon"
                      className="rounded-xl hover:bg-gray-300 w-12"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleRemoveModel("HuggingFace", huggingfaceModelInput)}
                      size="icon"
                      disabled={!huggingfaceModelInput}
                      className="rounded-xl hover:bg-gray-300 w-12"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Input model names in the format 'author name/model name' (e.g. microsoft/phi-4)
                  </p>
                </div>
              </div>

              {/* OpenRouter Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">OpenRouter API Key</h3>

                <div className="space-y-2">
                  <Label htmlFor="openrouter-key">Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="openrouter-key"
                      type="password"
                      value={getProviderConfig("OpenRouter").Key}
                      onChange={(e) => updateProviderConfig("OpenRouter", "Key", e.target.value)}
                      placeholder="sk-or-v1-...."
                      className="rounded-xl flex-1 max-w-[80%]"
                    />
                    <Button 
                      onClick={handleSave} disabled={isSaving}
                      className="w-[20%] min-w-[100px] rounded-xl hover:bg-gray-300"
                    >
                      {isSaving ? (
                        <span className="flex items-center">
                          Saving
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </span>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Models are automatically loaded from OpenRouter's API
                  </p>
                </div>
              </div>

              {/* Google Gemini Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">Google Gemini API Key</h3>

                <div className="space-y-2">
                  <Label htmlFor="gemini-key">Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="gemini-key"
                      type="password"
                      value={getProviderConfig("Gemini").Key}
                      onChange={(e) => updateProviderConfig("Gemini", "Key", e.target.value)}
                      placeholder="AIabc...."
                      className="rounded-xl flex-1 max-w-[80%]"
                    />
                    <Button 
                      onClick={handleSave} disabled={isSaving}
                      className="w-[20%] min-w-[100px] rounded-xl hover:bg-gray-300"
                    >
                      {isSaving ? (
                        <span className="flex items-center">
                          Saving
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gemini-models">Models</Label>
                  <div className="flex space-x-2">
                    <div className="flex-1 flex space-x-2">
                      <Input
                        id="gemini-models"
                        type="text"
                        value={geminiModelInput}
                        onChange={(e) => setGeminiModelInput(e.target.value)}
                        placeholder="model-name"
                        className="rounded-xl"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className='rounded-xl hover:bg-gray-300 w-12'
                                  size="icon"
                                  disabled={getModelList(getProviderConfig("Gemini").Models).length === 0}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="flex flex-1 flex-col bottom-full left-0 right-0 w-fit max-h-[400px] bg-[#35373c] rounded-xl shadow-lg border-gray-600 justify-center overflow-hidden">
                          {getModelList(getProviderConfig("Gemini").Models).map((model) => (
                            <DropdownMenuItem
                              key={model}
                              onClick={() => setGeminiModelInput(model)}
                              className="flex flex-1 cursor-pointer bg-[#35373c] hover:bg-[#3f4146] overflow-y-auto truncate rounded-xl group w-full px-4 py-2"
                            >
                              {model}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Button
                      onClick={() => handleAddModel("Gemini", geminiModelInput)}
                      size="icon"
                      className="rounded-xl hover:bg-gray-300 w-12"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleRemoveModel("Gemini", geminiModelInput)}
                      size="icon"
                      className="rounded-xl hover:bg-gray-300 w-12"
                      disabled={!geminiModelInput}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Input model names (e.g. gemini-2.0-flash)
                  </p>
                </div>
              </div>

              {/* Groq Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">Groq API Key</h3>

                <div className="space-y-2">
                  <Label htmlFor="groq-key">Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="groq-key"
                      type="password"
                      value={getProviderConfig("Groq").Key}
                      onChange={(e) => updateProviderConfig("Groq", "Key", e.target.value)}
                      placeholder="gsk_...."
                      className="rounded-xl flex-1 max-w-[80%]"
                    />
                    <Button 
                      onClick={handleSave} disabled={isSaving}
                      className="w-[20%] min-w-[100px] rounded-xl hover:bg-gray-300"
                    >
                      {isSaving ? (
                        <span className="flex items-center">
                          Saving
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </span>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Models are automatically loaded from Groq's API
                  </p>
                </div>
              </div>
              {/* Tavily Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">Tavily API Key</h3>

                <div className="space-y-2">
                  <Label htmlFor="tavily-key">Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="tavily-key"
                      type="password"
                      value={getProviderConfig("Tavily").Key}
                      onChange={(e) => updateProviderConfig("Tavily", "Key", e.target.value)}
                      placeholder="tvly-...."
                      className="rounded-xl flex-1 max-w-[80%]"
                    />
                    <Button 
                      onClick={handleSave} disabled={isSaving}
                      className="w-[20%] min-w-[100px] rounded-xl hover:bg-gray-300"
                    >
                      {isSaving ? (
                        <span className="flex items-center">
                          Saving
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </span>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tavily for web search results.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="Pull Models" className="h-full">
          <Card>
            <CardHeader>
              <CardTitle>Pull Models</CardTitle>
              <CardDescription>Pull Models from their respective providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <Label htmlFor="pull-model">Ollama</Label>
                <div className="flex space-x-2">
                  <Input
                    id="pull-model"
                    type="text"
                    value={pullModelName}
                    onChange={(e) => setPullModelName(e.target.value)}
                    placeholder="Enter model name (e.g. llama2)"
                    className="flex-1"
                    disabled={isPulling}
                  />
                  <Button 
                    onClick={handlePullModel} 
                    disabled={isPulling || !pullModelName.trim()}
                    className="w-[20%] min-w-[100px]"
                  >
                    {isPulling ? (
                      <span className="flex items-center">
                        Pulling...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Download className="mr-2 h-4 w-4" />
                        Pull
                      </span>
                    )}
                  </Button>
                </div>
                {isPulling && (
                  <div className="space-y-2">
                    <Progress value={pullProgress} />
                    <p className="text-sm text-muted-foreground text-center">
                      Pulling model: {pullProgress}%
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter the full name of the model, refer to the ollama models list on ollama site for the available models. (eg. gemma3:12b)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {activeTab === "api-keys" && (
        <div className="mt-6 flex items-center justify-between">
          {saveMessage && (
            <p className={`text-sm ${saveMessage.includes("Error") ? "text-destructive" : "text-green-600"}`}>
              {saveMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

