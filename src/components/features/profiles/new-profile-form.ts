// --- Form state ---

export interface ProfileFormState {
  name: string;
  description: string;
  scope: "global" | "model";
  modelId: string;
  ctxSize: string;
  threads: string;
  gpuLayers: string;
  flashAttention: boolean;
  port: string;
  host: string;
  parallel: string;
  contBatching: boolean;
  nPredict: string;
  timeout: string;
  metrics: boolean;
  apiKey: string;
  threadsBatch: string;
  batchSize: string;
  ubatchSize: string;
  cacheTypeK: string;
  cacheTypeV: string;
  splitMode: string;
  tensorSplit: string;
  mainGpu: string;
  kvOffload: boolean;
  fit: boolean;
  mmap: boolean;
  mlock: boolean;
  numa: boolean;
  temperature: string;
  topK: string;
  topP: string;
  minP: string;
  repeatPenalty: string;
  repeatLastN: string;
  presencePenalty: string;
  frequencyPenalty: string;
  seed: string;
  lora: string;
  mmproj: string;
  jinja: boolean;
  reasoningFormat: string;
  reasoningBudget: string;
  chatTemplate: string;
  ropeScaling: string;
  ropeScale: string;
  ropeFreqBase: string;
  ropeFreqScale: string;
  grammar: string;
  jsonSchema: string;
  logLevel: string;
  extraArgs: string;
}

export type ProfileFormAction =
  | { type: "SET_FIELD"; key: keyof ProfileFormState; value: string | boolean }
  | { type: "RESET"; defaults?: Partial<ProfileFormState> };

export const defaultFormState: ProfileFormState = {
  name: "",
  description: "",
  scope: "global",
  modelId: "",
  ctxSize: "8192",
  threads: "8",
  gpuLayers: "99",
  flashAttention: true,
  port: "8080",
  host: "127.0.0.1",
  parallel: "-1",
  contBatching: true,
  nPredict: "-1",
  timeout: "3600",
  metrics: false,
  apiKey: "",
  threadsBatch: "-1",
  batchSize: "2048",
  ubatchSize: "512",
  cacheTypeK: "f16",
  cacheTypeV: "f16",
  splitMode: "layer",
  tensorSplit: "",
  mainGpu: "0",
  kvOffload: true,
  fit: true,
  mmap: true,
  mlock: false,
  numa: false,
  temperature: "0.8",
  topK: "40",
  topP: "0.95",
  minP: "0.05",
  repeatPenalty: "1.1",
  repeatLastN: "64",
  presencePenalty: "0",
  frequencyPenalty: "0",
  seed: "-1",
  lora: "",
  mmproj: "",
  jinja: true,
  reasoningFormat: "auto",
  reasoningBudget: "-1",
  chatTemplate: "",
  ropeScaling: "",
  ropeScale: "0",
  ropeFreqBase: "0",
  ropeFreqScale: "0",
  grammar: "",
  jsonSchema: "",
  logLevel: "3",
  extraArgs: "",
};

export function profileFormReducer(state: ProfileFormState, action: ProfileFormAction): ProfileFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.key]: action.value };
    case "RESET":
      return { ...defaultFormState, ...action.defaults };
  }
}
