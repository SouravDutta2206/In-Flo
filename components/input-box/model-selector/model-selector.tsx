"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronUp, ConstructionIcon, Pin, PinOff } from "lucide-react"
import { useChat } from "@/context/chat-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from 'next/image'
import { Input } from "@/components/ui/input"
import { Model, OllamaListResponse, ModelResponse, GroupedModels, LogoProvider } from "@/types/models"
import { resolveModelLogoPath, resolveProviderLogoPath } from "@/lib/model-logos"
import { SearchBar } from "@/components/input-box/model-selector/SearchBar"
import { ProviderTabs } from "@/components/input-box/model-selector/ProviderTabs"


/**
 * ModelSelector lets users choose a model across providers, with search and pinning.
 * It aggregates models from settings and provider APIs, preserving current UI/UX.
 */
export function ModelSelector() {
  const {settings, updateChatSettings } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const [groupedModels, setGroupedModels] = useState<GroupedModels>({})
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [logoMap, setLogoMap] = useState<LogoProvider[]>([]) // State for logo data
  const [searchTerm, setSearchTerm] = useState("") // State for search term
  const [pinnedModels, setPinnedModels] = useState<string[]>([]) // State for pinned models

  // Initial mount: load pinned models and logo map
  useEffect(() => {
    setMounted(true)
    // Load pinned models from localStorage
    const storedPinnedModels = localStorage.getItem("pinnedModels")
    if (storedPinnedModels) {
      try {
        const parsedModels = JSON.parse(storedPinnedModels);
        if (Array.isArray(parsedModels)) {
          setPinnedModels(parsedModels);
        } else {
          console.warn("Invalid pinned models format in localStorage");
          localStorage.removeItem("pinnedModels"); // Clear invalid data
        }
      } catch (error) {
        console.error("Error parsing pinned models from localStorage:", error);
        localStorage.removeItem("pinnedModels"); // Clear corrupted data
      }
    }

    // Fetch logo data
    const fetchLogos = async () => {
      try {
        const response = await fetch('/data/logos.json');
        if (!response.ok) {
          console.warn('Failed to fetch logos.json. Status:', response.status);
          return;
        }
        const data = await response.json();
        setLogoMap(data.providers || []); // Assuming the structure is { providers: [...] }
      } catch (error) {
        console.error('Error fetching logos:', error);
      }
    };
    fetchLogos();
  }, [])

  // Logo resolution delegated to helper utils

  // Effect to save pinned models to localStorage whenever they change
  // Persist pinned models after initial mount
  useEffect(() => {
    if (mounted) { // Only save after initial mount and load
      localStorage.setItem("pinnedModels", JSON.stringify(pinnedModels));
    }
  }, [pinnedModels, mounted]);

  /** Fetch models from the local Ollama endpoint. */
  const fetchOllamaModels = async (): Promise<Model[]> => {
    try {
      const response = await fetch('/api/ollama/models');
      if (!response.ok) {
        console.warn('Failed to fetch Ollama models, proceeding without them.')
        return []
      }
      const data: OllamaListResponse = await response.json();
      return data.models.map(model => ({
        name: model.name,
        provider: 'Ollama'
      }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  };

  /** Fetch models from OpenRouter endpoint; requires server to expose proxy. */
  const fetchOpenRouterModels = async (): Promise<Model[]> => {
    try {
      const response = await fetch('/api/openrouter/models');
      if (!response.ok) {
        console.warn('Failed to fetch OpenRouter models, proceeding without them.')
        return []
      }
      const data: ModelResponse = await response.json();
      return data.data.map(model => ({
        name: model.id,
        provider: 'OpenRouter'
      }));
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return [];
    }
  };

  /** Fetch models from Groq; requires API key in settings. */
  const fetchGroqModels = async (): Promise<Model[]> => {

    const groqProvider = settings.providers.find(p => p.Provider === "Groq");
    const apiKey = groqProvider?.Key;

    if (!apiKey) {
      console.warn('No Groq API key found in settings, proceeding without Groq models.');
      return [];
    }

    try {
      const response = await fetch('/api/groq/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey
        })
      });
      if (!response.ok) {
        console.warn('Failed to fetch Groq models, proceeding without them.')
        return []
      }
      const data: ModelResponse = await response.json();
      return data.data.map(model => ({
        name: model.id,
        provider: 'Groq'
      }));
    } catch (error) {
      console.error('Error fetching Groq models:', error);
      return [];
    }
  };

  /** Fetch models from Gemini; requires API key in settings. */
  const fetchGeminiModels = async (): Promise<Model[]> => {
    // Get the Gemini API key from settings
    const geminiProvider = settings.providers.find(p => p.Provider === "Gemini");
    const apiKey = geminiProvider?.Key;

    if (!apiKey) {
      console.warn('No Gemini API key found in settings, proceeding without Gemini models.');
      return [];
    }

    try {
      const response = await fetch('/api/gemini/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey
        })
      });


      if (!response.ok) {
        console.warn('Failed to fetch Gemini models, proceeding without them.');
        return [];
      }

      const data: ModelResponse = await response.json();
      return data.data.map(model => ({
        name: model.id,
        provider: 'Gemini'
      }));
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      return [];
    }
  };

  // Aggregate models from settings + providers and initialize tabs/selection
  useEffect(() => {
    const loadAllModels = async () => {
      const settingsModels: Model[] = [];
      settings.providers.forEach((provider) => {
        if (provider.Models && provider.Provider !== "OpenRouter") {  // Skip OpenRouter models from settings
          const modelNames = provider.Models.split(",").map((m) => m.trim()).filter(name => name);
          modelNames.forEach((name) => {
            let providerName = provider.Provider
            settingsModels.push({ name, provider: providerName });
          });
        }
      });

      const [ollamaModels, openRouterModels, geminiModels, groqModels] = await Promise.all([
        fetchOllamaModels(),
        fetchOpenRouterModels(),
        fetchGeminiModels(),
        fetchGroqModels()
      ]);
      
      const allModels = [...settingsModels, ...ollamaModels, ...openRouterModels, ...geminiModels, ...groqModels];
      
      const grouped: GroupedModels = {};
      allModels.forEach(model => {
        const providerKey = model.provider || "Unknown";
        if (!grouped[providerKey]) {
          grouped[providerKey] = [];
        }
        grouped[providerKey].push(model);
      });

      setGroupedModels(grouped);

      // Set the initial active tab to the first provider with models
      const providersWithModels = Object.keys(grouped).filter(p => grouped[p].length > 0);
      if (providersWithModels.length > 0) {
        // Find the provider of the currently selected model, if any
        const currentProvider = allModels.find(m => m.name === settings.activeModel)?.provider;
        if (currentProvider && grouped[currentProvider]) {
           setActiveTab(currentProvider);
        } else {
           // Fallback to the first provider if the current model's provider isn't found or has no models
           setActiveTab(providersWithModels[0]);
        }
      }

      if (settings.activeModel) {
        const modelExists = allModels.some((model) => model.name === settings.activeModel)
        if (modelExists) {
          setSelectedModel(settings.activeModel)
        } else {
          setSelectedModel("")
          // If selected model doesn't exist, maybe clear activeTab or set to first provider?
          if (providersWithModels.length > 0) {
            setActiveTab(providersWithModels[0]);
          }
        }
      }
    };

    loadAllModels();
  }, [settings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Select a model and persist in chat settings
  const handleSelectModel = (model: Model) => {
    setSelectedModel(model.name);
    const updatedSettings = {
      ...settings,
      activeModel: model.name,
      activeProvider: model.provider
    };
    updateChatSettings(updatedSettings);
    setIsOpen(false);
  };

  // Function to toggle pin status of a model
  // Pin/unpin a model without selecting it
  const handleTogglePin = (modelName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the model when clicking the pin
    setPinnedModels(prevPinned => {
      if (prevPinned.includes(modelName)) {
        // Unpin: Remove the model name
        return prevPinned.filter(name => name !== modelName);
      } else {
        // Pin: Add the model name
        return [...prevPinned, modelName];
      }
    });
  };

  if (!mounted) {
    return null // Or a placeholder button
  }

  const providers = Object.keys(groupedModels).filter(p => groupedModels[p].length > 0); // Only show tabs for providers with models

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Button to show selected model and toggle dropdown */}
      <Button
        variant="ghost"
        className="flex w-full justify-between px-2 py-1.5 ml-2 mb-1 text-sm text-gray-200 bg-transparent hover:bg-muted/80 rounded-md transition-colors"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span className="truncate ml-2">{selectedModel || "Choose Model"}</span>
        <ChevronUp className={cn("h-4 w-4 transition-transform mr-2 flex-shrink-0", !isOpen && "rotate-180")} />
      </Button>

      {/* Dropdown with Tabs */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 right-0 ml-2 mb-1 w-[600px] h-[400px] bg-muted text-muted-foreground rounded-xl shadow-lg z-[60] border border-gray-700 flex overflow-hidden"
          onMouseDown={(e) => {
            // Only prevent default if not clicking on an input
            if (!(e.target instanceof HTMLInputElement)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onClick={(e) => {
            // Only prevent default if not clicking on an input
            if (!(e.target instanceof HTMLInputElement)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {/* Left Side: Container for Search + List */}          
          <div className="flex-1 min-w-0 flex flex-col bg-muted"> {/* flex-1 takes width, flex-col stacks items */}
            {/* Search Bar (Stays at top) */}
            <SearchBar value={searchTerm} onChange={setSearchTerm} />

            {/* Scrollable Model List Area */}            
            <div className="flex-1 overflow-y-auto"> {/* flex-1 takes height, scrollable */}              
              {activeTab && groupedModels[activeTab] ? (() => {
                const filteredModels = groupedModels[activeTab].filter(model =>
                  model.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                const pinned = filteredModels
                  .filter(model => pinnedModels.includes(model.name))
                  .sort((a, b) => a.name.localeCompare(b.name)); // Sort pinned alphabetically

                const regular = filteredModels.filter(model => !pinnedModels.includes(model.name));

                const renderModelItem = (model: Model, index: number) => {
                  const logoPath = resolveModelLogoPath(model.name, model.provider, logoMap);
                  const isPinned = pinnedModels.includes(model.name);

                  return (
                    <div
                      key={`${model.provider}-${model.name}-${index}`} // More specific key
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex items-center justify-between w-full px-4 py-3 text-left text-sm cursor-pointer group", // Added group for hover effect on button
                        selectedModel === model.name ? "bg-[#3f4146]" : "hover:bg-[#35373c]"
                      )}
                      onClick={() => handleSelectModel(model)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectModel(model);
                        }
                      }}
                    >
                      <div className="flex items-center overflow-hidden mr-2"> {/* Container for logo and name */}
                        {logoPath && (
                          <Image
                            src={logoPath}
                            alt={`${model.name} logo`}
                            width={16}
                            height={16}
                            className="mr-2 flex-shrink-0"
                          />
                        )}
                        <div className="font-medium text-gray-100 truncate">{model.name}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 p-1 text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100", // Show on hover/focus
                          isPinned && "opacity-100 text-blue-400 hover:text-blue-300", // Always show if pinned, different color
                           !isPinned && "hover:text-gray-200" // Hover color when not pinned
                        )}
                        onClick={(e) => handleTogglePin(model.name, e)}
                        aria-label={isPinned ? "Unpin model" : "Pin model"}
                      >
                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                };

                return (
                  <>
                    {pinned.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pinned</div>
                        {pinned.map(renderModelItem)}
                        {regular.length > 0 && <div className="h-px bg-gray-700 my-2 mx-4"></div>} {/* Separator */}
                      </>
                    )}
                    {regular.length > 0 && (
                       <>
                        {pinned.length > 0 && <div className="px-4 pt-1 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Models</div>}
                        {regular.map(renderModelItem)}
                       </>
                    )}
                    {filteredModels.length === 0 && searchTerm && (
                        <div className="p-4 text-center text-gray-400">No models match your search.</div>
                    )}
                  </>
                );

              })() : (
                <div className="p-4 text-center text-gray-400">Select a provider tab.</div>
              )}
            </div> {/* End Scrollable Model List Area */}            
          </div> {/* End Left Side */}          

          {/* Right Side: Provider Tabs */}
          <ProviderTabs
            providers={providers}
            active={activeTab}
            onSelect={(p) => {
              setActiveTab(p)
              setSearchTerm("")
            }}
          />
        </div>
      )}
    </div>
  )
}

