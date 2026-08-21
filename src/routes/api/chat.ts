import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAIModelId } from "@/lib/ai-models";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  model: z.string().trim(),
  conversationId: z.string().uuid().optional(),
});

function publicError(error: unknown): { status: number; message: string } {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "UNAUTHORIZED") return { status: 401, message: "Authentication required." };
  if (code === "UNSUPPORTED_MODEL") return { status: 400, message: "Unsupported AI model." };
  if (code === "CONVERSATION_NOT_FOUND") return { status: 404, message: "Conversation not found." };
  if (code === "KNOWLEDGE_BASE_REQUIRED" || code === "KNOWLEDGE_BASE_NOT_FOUND") {
    return { status: 400, message: "Select a knowledge base before sending a message." };
  }
  if (code === "OPENAI_NOT_CONFIGURED") return { status: 503, message: "OpenAI is not configured." };
  if (code === "ANTHROPIC_NOT_CONFIGURED") return { status: 503, message: "Anthropic is not configured." };
  if (code.includes("going a little fast")) return { status: 429, message: "Too many requests. Please try again shortly." };
  return { status: 500, message: "Unable to generate response. Please try again." };
}

async function resolveConversationId(db: any, userId: string, supplied?: string): Promise<string> {
  if (supplied) return supplied;

  const settings = await db
    .from("user_settings")
    .select("default_kb_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (settings.error) throw new Error("DATABASE_ERROR");

  const created = await db
    .from("conversations")
    .insert({ user_id: userId, kb_id: settings.data?.default_kb_id ?? null })
    .select("id")
    .single();
  if (created.error || !created.data) throw new Error("DATABASE_ERROR");
  return created.data.id;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json(
            { success: false, error: "Invalid request. Message must be 1-4000 characters." },
            { status: 400 },
          );
        }

        if (!isAIModelId(parsed.model)) {
          return Response.json({ success: false, error: "Unsupported AI model." }, { status: 400 });
        }

        try {
          const [{ authenticateRequest }, { rateLimit }, rag, providers] = await Promise.all([
            import("@/lib/request-auth.server"),
            import("@/lib/rag.server"),
            import("@/lib/rag-chat.server"),
            import("@/lib/ai-providers.server"),
          ]);

          const { supabase: db, userId } = await authenticateRequest(request);
          rateLimit(`chat:${userId}`, 30, 60_000);
          const conversationId = await resolveConversationId(db, userId, parsed.conversationId);
          const prepared = await rag.prepareGroundedChat(db, userId, conversationId, parsed.message);
          const wantsStream = request.headers.get("accept")?.includes("text/event-stream") ?? false;

          if (!wantsStream) {
            const answer = prepared.fallback ?? await providers.collectAIResponse(parsed.model, prepared.messages, request.signal);
            const persisted = await rag.persistAssistantResponse(
              db,
              userId,
              conversationId,
              parsed.model,
              answer,
              prepared.chunks,
            );
            return Response.json({
              success: true,
              message: answer,
              model: parsed.model,
              conversationId,
              assistantMessage: persisted.message,
              citations: persisted.citations,
            });
          }

          const encoder = new TextEncoder();
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              const send = (payload: unknown) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
              };

              let answer = "";
              try {
                send({ type: "start", success: true, model: parsed.model, conversationId });

                if (prepared.fallback) {
                  answer = prepared.fallback;
                  send({ type: "delta", delta: answer, model: parsed.model });
                } else {
                  for await (const delta of providers.generateAIResponse(parsed.model, prepared.messages, request.signal)) {
                    if (request.signal.aborted) break;
                    answer += delta;
                    send({ type: "delta", delta, model: parsed.model });
                  }
                }

                if (request.signal.aborted) {
                  controller.close();
                  return;
                }

                if (!answer.trim()) throw new Error("EMPTY_PROVIDER_RESPONSE");
                const persisted = await rag.persistAssistantResponse(
                  db,
                  userId,
                  conversationId,
                  parsed.model,
                  answer.trim(),
                  prepared.chunks,
                );
                send({
                  type: "done",
                  success: true,
                  message: answer.trim(),
                  model: parsed.model,
                  conversationId,
                  assistantMessage: persisted.message,
                  citations: persisted.citations,
                });
              } catch (error) {
                if (!request.signal.aborted) {
                  const safe = publicError(error);
                  send({ type: "error", success: false, error: safe.message });
                }
              } finally {
                try {
                  controller.close();
                } catch {
                  // Client may already have aborted the response stream.
                }
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (error) {
          const safe = publicError(error);
          return Response.json({ success: false, error: safe.message }, { status: safe.status });
        }
      },
    },
  },
});
