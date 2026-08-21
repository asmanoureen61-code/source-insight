const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const EMBED_MODEL = "openai/text-embedding-3-small";
export const EMBED_DIMS = 1536;

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(500, "AI is not configured for this workspace.");
  return key;
}

async function gateway(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  if (res.ok) return res;

  let message = `AI request failed (${res.status}).`;
  try {
    const payload = (await res.json()) as { message?: string; error?: { message?: string } };
    message = payload.error?.message ?? payload.message ?? message;
  } catch {
    /* keep default */
  }

  if (res.status === 429) message = "Too many requests right now. Please try again in a moment.";
  if (res.status === 402) message = message || "AI credits are exhausted for this workspace.";
  throw new AiError(res.status, message);
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 64) {
    const batch = inputs.slice(i, i + 64);
    const res = await gateway("/embeddings", { model: EMBED_MODEL, input: batch });
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

type ChatContent = string | Array<Record<string, unknown>>;

export async function chatCompletion(opts: {
  model?: string;
  messages: { role: "system" | "user" | "assistant"; content: ChatContent }[];
  maxTokens?: number;
}): Promise<string> {
  const res = await gateway("/chat/completions", {
    model: opts.model ?? "google/gemini-3.7-flash",
    messages: opts.messages,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  });
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Extract plain text from a base64 document using a multimodal model. */
export async function extractDocumentText(
  fileName: string,
  mimeType: string,
  base64: string,
): Promise<string> {
  return chatCompletion({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all readable text from this document verbatim as plain markdown. Preserve headings, lists and tables. Do not summarise, comment, or add anything.",
          },
          {
            type: "file",
            file: { filename: fileName, file_data: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
  });
}
