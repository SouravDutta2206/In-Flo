/** Capability modalities for a model. */
export interface ModelCapabilities {
  input: string[]
  output: string[]
}

/** Rich model descriptor with capabilities. */
export interface Model {
  name: string
  model_id: string
  provider: string
  capabilities: ModelCapabilities
}

/** Aggregate response from POST /api/models. */
export interface ModelsResponse {
  data: Model[]
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