import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
  AI_MODELS,
  type AIChatMessage,
  type AIModelId,
  isAIModelId,
} from "./ai-models";

const OPENAI_MODEL_ID = process.env["OPENAI_MODEL_ID"] || "gpt-5.6-sol";
const CLAUDE_OPUS_MODEL_ID = process.env["CLAUDE_OPUS_MODEL_ID"];

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function openai(): OpenAI {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  openaiClient ??= new OpenAI({ apiKey });
  return openaiClient;
}

function anthropic(): Anthropic {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || !CLAUDE_OPUS_MODEL_ID) throw new Error("ANTHROPIC_NOT_CONFIGURED");
  anthropicClient ??= new Anthropic({ apiKey });
  return anthropicClient;
}

export async function* callOpenAI(
  messages: AIChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const instructions = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const input = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  const stream = await openai().responses.create(
    {
      model: OPENAI_MODEL_ID,
      instructions: instructions || undefined,
      input,
      stream: true,
    },
    { signal },
  );

  for await (const event of stream) {
    if (signal?.aborted) return;
    if (event.type === "response.output_text.delta" && event.delta) {
      yield event.delta;
    }
  }
}

export async function* callAnthropic(
  messages: AIChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!CLAUDE_OPUS_MODEL_ID) throw new Error("ANTHROPIC_NOT_CONFIGURED");

  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const providerMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  const stream = anthropic().messages.stream(
    {
      model: CLAUDE_OPUS_MODEL_ID,
      max_tokens: 4096,
      system: system || undefined,
      messages: providerMessages,
    },
    { signal },
  );

  for await (const event of stream) {
    if (signal?.aborted) return;
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export function generateAIResponse(
  model: AIModelId,
  messages: AIChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!isAIModelId(model)) throw new Error("UNSUPPORTED_MODEL");

  switch (AI_MODELS[model].provider) {
    case "openai":
      return callOpenAI(messages, signal);
    case "anthropic":
      return callAnthropic(messages, signal);
    default:
      throw new Error("UNSUPPORTED_MODEL");
  }
}

export async function collectAIResponse(
  model: AIModelId,
  messages: AIChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  let output = "";
  for await (const delta of generateAIResponse(model, messages, signal)) output += delta;
  return output.trim();
}
