export const AI_MODELS = {
  "gpt-5.6-sol": {
    name: "GPT-5.6 Sol",
    provider: "openai",
  },
  "claude-opus": {
    name: "Claude Opus",
    provider: "anthropic",
  },
} as const;

export type AIModelId = keyof typeof AI_MODELS;
export type AIProviderName = (typeof AI_MODELS)[AIModelId]["provider"];

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const DEFAULT_AI_MODEL: AIModelId = "gpt-5.6-sol";

export function isAIModelId(value: unknown): value is AIModelId {
  return typeof value === "string" && value in AI_MODELS;
}

export function modelLabel(model: string | null | undefined): string {
  return isAIModelId(model) ? AI_MODELS[model].name : "AI";
}
