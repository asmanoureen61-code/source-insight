import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  answerQuestion,
  assertOk,
  ingestDocument,
  maybeTitleConversation,
  rateLimit,
  reindexDocument,
  type Db,
} from "./rag.server";

const uuid = z.string().uuid();

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    const userId = context.userId;

    const [kbs, docs, convos, settings, profile] = await Promise.all([
      db.from("knowledge_bases").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
      db.from("documents").select("id, kb_id, status").eq("user_id", userId),
      db
        .from("conversations")
        .select("id, title, kb_id, updated_at, pinned")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(8),
      db.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);

    const documents = docs.data ?? [];
    return {
      knowledgeBases: (kbs.data ?? []).map((kb) => ({
        ...kb,
        documentCount: documents.filter((d) => d.kb_id === kb.id).length,
      })),
      recentConversations: convos.data ?? [],
      settings: settings.data,
      profile: profile.data,
      stats: {
        knowledgeBases: kbs.data?.length ?? 0,
        indexedDocuments: documents.filter((d) => d.status === "ready").length,
        conversations: convos.data?.length ?? 0,
        processing: documents.filter((d) => d.status === "processing" || d.status === "queued").length,
      },
    };
  });

export const listKnowledgeBases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    const [kbs, docs] = await Promise.all([
      db.from("knowledge_bases").select("*").eq("user_id", context.userId).order("updated_at", { ascending: false }),
      db.from("documents").select("id, kb_id, status").eq("user_id", context.userId),
    ]);
    if (kbs.error) throw new Error(kbs.error.message);
    const documents = docs.data ?? [];
    return (kbs.data ?? []).map((kb) => ({
      ...kb,
      documentCount: documents.filter((d) => d.kb_id === kb.id).length,
      processingCount: documents.filter((d) => d.kb_id === kb.id && d.status === "processing").length,
    }));
  });

export const createKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(300).default("") }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    return assertOk(
      await db
        .from("knowledge_bases")
        .insert({ user_id: context.userId, name: data.name, description: data.description })
        .select("*")
        .single(),
    );
  });

export const updateKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: uuid,
        name: z.string().trim().min(1).max(80).optional(),
        description: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const { id, ...patch } = data;
    return assertOk(
      await db.from("knowledge_bases").update(patch).eq("id", id).eq("user_id", context.userId).select("*").single(),
    );
  });

export const deleteKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const res = await db.from("knowledge_bases").delete().eq("id", data.id).eq("user_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const getKnowledgeBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const kb = assertOk(
      await db.from("knowledge_bases").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle(),
    );
    const docs = await db
      .from("documents")
      .select("id, title, source_type, source_url, file_name, mime_type, size_bytes, status, error_message, chunk_count, created_at, updated_at")
      .eq("kb_id", kb.id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (docs.error) throw new Error(docs.error.message);
    const documents = docs.data ?? [];
    return {
      kb,
      documents,
      stats: {
        documents: documents.length,
        chunks: documents.reduce((sum, d) => sum + (d.chunk_count ?? 0), 0),
        storage: documents.reduce((sum, d) => sum + Number(d.size_bytes ?? 0), 0),
        lastIndexed: documents.find((d) => d.status === "ready")?.updated_at ?? null,
      },
    };
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    const res = await db
      .from("documents")
      .select("id, kb_id, title, source_type, file_name, size_bytes, status, error_message, chunk_count, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    const kbs = await db.from("knowledge_bases").select("id, name").eq("user_id", context.userId);
    return { documents: res.data ?? [], knowledgeBases: kbs.data ?? [] };
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    return assertOk(
      await db.from("documents").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle(),
    );
  });

export const uploadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        kbId: uuid,
        sourceType: z.enum(["file", "url", "text"]),
        title: z.string().trim().min(1).max(200),
        text: z.string().max(400_000).optional(),
        url: z.string().max(2048).optional(),
        fileName: z.string().max(255).optional(),
        mimeType: z.string().max(200).optional(),
        fileBase64: z.string().max(15_000_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`upload:${context.userId}`, 20, 60_000);
    return ingestDocument(context.supabase as Db, context.userId, data);
  });

export const reindexDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    rateLimit(`index:${context.userId}`, 20, 60_000);
    return reindexDocument(context.supabase as Db, context.userId, data.id);
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const res = await db.from("documents").delete().eq("id", data.id).eq("user_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    const [convos, kbs] = await Promise.all([
      db
        .from("conversations")
        .select("*")
        .eq("user_id", context.userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false }),
      db.from("knowledge_bases").select("id, name").eq("user_id", context.userId),
    ]);
    if (convos.error) throw new Error(convos.error.message);
    return { conversations: convos.data ?? [], knowledgeBases: kbs.data ?? [] };
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ kbId: uuid.nullable().optional() }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    return assertOk(
      await db
        .from("conversations")
        .insert({ user_id: context.userId, kb_id: data.kbId ?? null })
        .select("*")
        .single(),
    );
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const conversation = assertOk(
      await db.from("conversations").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle(),
    );
    const [messages, kbs] = await Promise.all([
      db
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true }),
      db.from("knowledge_bases").select("id, name").eq("user_id", context.userId),
    ]);
    if (messages.error) throw new Error(messages.error.message);
    const ids = (messages.data ?? []).map((m) => m.id);
    const citations = ids.length
      ? (await db.from("citations").select("*").in("message_id", ids).eq("user_id", context.userId)).data ?? []
      : [];
    return { conversation, messages: messages.data ?? [], citations, knowledgeBases: kbs.data ?? [] };
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: uuid,
        title: z.string().trim().min(1).max(120).optional(),
        pinned: z.boolean().optional(),
        kbId: uuid.nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.pinned !== undefined) patch["pinned"] = data.pinned;
    if (data.kbId !== undefined) patch["kb_id"] = data.kbId;
    return assertOk(
      await db.from("conversations").update(patch).eq("id", data.id).eq("user_id", context.userId).select("*").single(),
    );
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const res = await db.from("conversations").delete().eq("id", data.id).eq("user_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: uuid,
        kbId: uuid,
        question: z.string().trim().min(1).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    rateLimit(`chat:${context.userId}`, 30, 60_000);
    const db = context.supabase as Db;

    assertOk(
      await db.from("conversations").select("id").eq("id", data.conversationId).eq("user_id", context.userId).maybeSingle(),
    );
    assertOk(await db.from("knowledge_bases").select("id").eq("id", data.kbId).eq("user_id", context.userId).maybeSingle());

    const userMessage = assertOk(
      await db
        .from("messages")
        .insert({
          user_id: context.userId,
          conversation_id: data.conversationId,
          role: "user",
          content: data.question,
        })
        .select("*")
        .single(),
    );

    await db.from("conversations").update({ kb_id: data.kbId }).eq("id", data.conversationId).eq("user_id", context.userId);

    const result = await answerQuestion(db, context.userId, data);
    await maybeTitleConversation(db, context.userId, data.conversationId);

    return { userMessage, ...result };
  });

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    const [settings, profile, kbs] = await Promise.all([
      db.from("user_settings").select("*").eq("user_id", context.userId).maybeSingle(),
      db.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      db.from("knowledge_bases").select("id, name").eq("user_id", context.userId),
    ]);
    return { settings: settings.data, profile: profile.data, knowledgeBases: kbs.data ?? [] };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workspace_name: z.string().trim().min(1).max(80).optional(),
        default_kb_id: uuid.nullable().optional(),
        response_length: z.enum(["concise", "balanced", "detailed"]).optional(),
        citation_style: z.enum(["inline", "footnote"]).optional(),
        model: z.string().max(80).optional(),
        top_k: z.number().int().min(1).max(20).optional(),
        similarity_threshold: z.number().min(0).max(1).optional(),
        retention_days: z.number().int().min(0).max(3650).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    return assertOk(
      await db
        .from("user_settings")
        .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" })
        .select("*")
        .single(),
    );
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ display_name: z.string().trim().min(1).max(80) }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    return assertOk(
      await db
        .from("profiles")
        .upsert({ id: context.userId, display_name: data.display_name }, { onConflict: "id" })
        .select("*")
        .single(),
    );
  });

export const purgeData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ target: z.enum(["chats", "documents"]) }).parse(data))
  .handler(async ({ context, data }) => {
    const db = context.supabase as Db;
    const table = data.target === "chats" ? "conversations" : "documents";
    const res = await db.from(table).delete().eq("user_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
