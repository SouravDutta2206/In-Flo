/** Minimal model descriptor used in the UI. */
export interface Model {
    name: string
    provider: string
}
  
/** Shape returned by Ollama list API. */
export interface OllamaModel {
name: string
modified_at: string
size: number
}

/** Response from /api/ollama/models. */
export interface OllamaListResponse {
models: OllamaModel[]
}

/** Generic model listing item with id. */
export interface ModelData {
id: string;
}

/** Response containing model id list from provider endpoints. */
export interface ModelResponse {
data: ModelData[]
}

/** Map of provider name to models list. */
export interface GroupedModels {
[provider: string]: Model[]
}

/** Mapping from a name substring to a public logo path. */
export interface LogoProvider {
name: string;
path: string;
}