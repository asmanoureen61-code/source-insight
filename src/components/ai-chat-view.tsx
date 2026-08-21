import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  RefreshCw,
  Send,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import {
  getConversation,
  getSettings,
  listKnowledgeBases,
  updateConversation,
  updateSettings,
} from "@/lib/api.functions";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL,
  isAIModelId,
  modelLabel,
  type AIModelId,
} from "@/lib/ai-models";

type ChatViewProps = {
  conversationId: string | null;
  initialKbId?: string | null;
  onSource: (source: Record<string, unknown>) => void;
};

type ChatRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model_used?: string | null;
  loading?: boolean;
  stopped?: boolean;
};

type StreamEvent = {
  type: "start" | "delta" | "done" | "error";
  delta?: string;
  error?: string;
  model?: string;
  message?: string;
};

const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.22 },
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function consumeSse(
  response: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  if (!response.body) throw new Error("Streaming response unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);
        try {
          onEvent(JSON.parse(raw) as StreamEvent);
        } catch {
          // Ignore malformed partial frames; valid SSE frames remain isolated.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function MarkdownMessage({ children }: { children: string }) {
  return (
    <div className="chat-markdown text-[15px] leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: content }) => <p className="mb-3 last:mb-0">{content}</p>,
          ul: ({ children: content }) => <ul className="mb-3 list-disc space-y-1 pl-5">{content}</ul>,
          ol: ({ children: content }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{content}</ol>,
          blockquote: ({ children: content }) => (
            <blockquote className="my-3 border-l-2 border-accent pl-4 text-muted-foreground">{content}</blockquote>
          ),
          pre: ({ children: content }) => (
            <pre className="my-3 overflow-x-auto rounded-xl bg-primary p-4 text-sm leading-6 text-primary-foreground scrollbar-slim">
              {content}
            </pre>
          ),
          code: ({ className, children: content }) => (
            <code
              className={cx(
                className,
                className?.includes("language-")
                  ? "font-mono"
                  : "rounded bg-cream-200 px-1.5 py-0.5 font-mono text-[.9em]",
              )}
            >
              {content}
            </code>
          ),
          table: ({ children: content }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">{content}</table>
            </div>
          ),
          th: ({ children: content }) => <th className="border-b border-border bg-cream-100 px-3 py-2 text-left">{content}</th>,
          td: ({ children: content }) => <td className="border-b border-border px-3 py-2 align-top">{content}</td>,
          a: ({ children: content, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-4">
              {content}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function ModelSelector({ value, onChange, disabled }: { value: AIModelId; onChange: (value: AIModelId) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 min-w-44 items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface px-3 text-left text-sm transition hover:bg-cream-100 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          <span className="mr-2 text-xs text-muted-foreground">Model</span>
          <span className="font-medium">{AI_MODELS[value].name}</span>
        </span>
        <ChevronDown className={cx("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            role="listbox"
            className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg"
          >
            {(Object.entries(AI_MODELS) as Array<[AIModelId, (typeof AI_MODELS)[AIModelId]]>).map(([id, item]) => (
              <button
                type="button"
                role="option"
                aria-selected={value === id}
                key={id}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition",
                  value === id ? "bg-accent-light text-accent" : "hover:bg-cream-100",
                )}
              >
                <span>
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-xs capitalize text-muted-foreground">{item.provider}</span>
                </span>
                {value === id ? <Check className="h-4 w-4" /> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function AIChatView({ conversationId, initialKbId, onSource }: ChatViewProps) {
  const [data, setData] = useState<any>(null);
  const [kbs, setKbs] = useState<any[]>([]);
  const [kbId, setKbId] = useState(initialKbId || "");
  const [model, setModel] = useState<AIModelId>(DEFAULT_AI_MODEL);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tempMessages, setTempMessages] = useState<ChatRow[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const settingsPromise = getSettings().catch(() => null);
    if (conversationId) {
      const [conversation, settings] = await Promise.all([
        getConversation({ data: { id: conversationId } } as any),
        settingsPromise,
      ]);
      const d = conversation as any;
      setData(d);
      setKbs(d.knowledgeBases || []);
      setKbId(d.conversation?.kb_id || initialKbId || d.knowledgeBases?.[0]?.id || "");
      const preferred = (settings as any)?.settings?.model;
      if (isAIModelId(preferred)) setModel(preferred);
      setTempMessages([]);
      return;
    }

    const [list, settings] = await Promise.all([listKnowledgeBases(), settingsPromise]);
    const knowledgeBases = list as any[];
    setKbs(knowledgeBases);
    setKbId(initialKbId || knowledgeBases[0]?.id || "");
    const preferred = (settings as any)?.settings?.model;
    if (isAIModelId(preferred)) setModel(preferred);
    setData({ messages: [], citations: [], conversation: { title: "New chat" } });
  };

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [conversationId]);

  const citationsByMessage = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const citation of data?.citations || []) {
      map.set(citation.message_id, [...(map.get(citation.message_id) || []), citation]);
    }
    return map;
  }, [data]);

  const messages: ChatRow[] = [...(data?.messages || []), ...tempMessages];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "end" });
  }, [messages.length, tempMessages, busy]);

  async function selectModel(next: AIModelId) {
    setModel(next);
    try {
      await updateSettings({ data: { model: next } } as any);
    } catch {
      // Model selection still applies to current chat if preference save fails.
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setTempMessages((current) =>
      current.map((message) =>
        message.id === "temp-ai" ? { ...message, loading: false, stopped: true } : message,
      ),
    );
  }

  async function send(event?: React.FormEvent, overrideQuestion?: string) {
    event?.preventDefault();
    const prompt = (overrideQuestion ?? question).trim();
    if (!prompt || !kbId || !conversationId || busy) return;

    setBusy(true);
    setError("");
    if (!overrideQuestion) setQuestion("");
    setTempMessages([
      { id: "temp-user", role: "user", content: prompt },
      { id: "temp-ai", role: "assistant", content: "", model_used: model, loading: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await updateConversation({ data: { id: conversationId, kbId } } as any);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: prompt,
          model,
          conversationId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to generate response. Please try again.");
      }

      let streamError = "";
      await consumeSse(response, (streamEvent) => {
        if (streamEvent.type === "delta" && streamEvent.delta) {
          setTempMessages((current) =>
            current.map((message) =>
              message.id === "temp-ai"
                ? { ...message, content: message.content + streamEvent.delta, loading: false }
                : message,
            ),
          );
        }
        if (streamEvent.type === "error") streamError = streamEvent.error || "Unable to generate response.";
      });

      if (streamError) throw new Error(streamError);
      if (!controller.signal.aborted) await load();
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "Unable to generate response. Please try again.");
      setTempMessages((current) => current.filter((message) => message.id !== "temp-ai"));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function regenerate(messageIndex: number) {
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
      const previous = messages[index];
      if (previous?.role === "user") {
        void send(undefined, previous.content);
        return;
      }
    }
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[980px] animate-pulse space-y-5">
        <div className="h-12 rounded-xl bg-cream-100" />
        <div className="h-[55vh] rounded-2xl bg-cream-100" />
      </div>
    );
  }

  return (
    <motion.section {...pageMotion} className="mx-auto flex min-h-[calc(100vh-145px)] max-w-[980px] flex-col">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold">{data.conversation?.title || "New chat"}</h1>
          <p className="text-xs text-muted-foreground">Grounded answers · model switchable per message</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Knowledge base"
            value={kbId}
            disabled={busy}
            onChange={(event) => setKbId(event.target.value)}
            className="h-10 min-w-44 rounded-xl border border-border-strong bg-surface px-3 text-sm disabled:opacity-60"
          >
            {kbs.map((kb: any) => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
          </select>
          <ModelSelector value={model} onChange={(next) => void selectModel(next)} disabled={busy} />
        </div>
      </div>

      {!messages.length ? (
        <div className="flex min-h-[58vh] flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-light text-accent"><Bot className="h-6 w-6" /></div>
          <h2 className="mt-5 font-display text-2xl font-semibold">Ask your knowledge base</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Choose GPT-5.6 Sol or Claude Opus. Answers remain grounded in indexed sources.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {["Summarize key points", "What are the main policies?", "Compare important sections", "Find information about…"].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setQuestion(prompt)}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-cream-100"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-7 py-6">
          {messages.map((message, index) => {
            const citations = citationsByMessage.get(message.id) || [];
            return (
              <div key={`${message.id}-${index}`} className={cx("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx(message.role === "user" ? "max-w-[85%] rounded-[16px_16px_4px_16px] bg-cream-200 px-4 py-3 sm:max-w-[75%]" : "w-full")}>
                  {message.role === "assistant" ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent-light text-accent"><Bot className="h-3.5 w-3.5" /></div>
                      <span>Verity</span>
                      <span className="rounded-full border border-border bg-cream-100 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {modelLabel(message.model_used)}
                      </span>
                    </div>
                  ) : null}

                  {message.loading && !message.content ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-2 w-2 animate-soft-pulse rounded-full bg-accent" />
                      Searching sources and drafting answer…
                    </div>
                  ) : message.role === "assistant" ? (
                    <MarkdownMessage>{message.content}</MarkdownMessage>
                  ) : (
                    <div className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</div>
                  )}

                  {message.stopped ? <p className="mt-2 text-xs text-muted-foreground">Generation stopped.</p> : null}

                  {citations.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {citations.map((citation: any) => (
                        <button
                          key={citation.id}
                          onClick={() => onSource(citation)}
                          className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-cream-300"
                        >
                          [{citation.marker}] {citation.document_title}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {message.role === "assistant" && !message.loading && message.content ? (
                    <div className="mt-3 flex gap-1">
                      <button
                        onClick={() => void navigator.clipboard.writeText(message.content)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-cream-100"
                        title="Copy response"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => regenerate(index)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-cream-100 disabled:opacity-50"
                        title="Regenerate response"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {error ? <div className="mb-3 rounded-xl bg-error-bg p-3 text-sm text-error">{error}</div> : null}

      <form onSubmit={send} className="sticky bottom-4 mt-auto rounded-2xl border border-border-strong bg-surface p-2 shadow-lg">
        <textarea
          value={question}
          maxLength={4000}
          disabled={busy}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !busy) {
              event.preventDefault();
              void send();
            }
          }}
          className="max-h-[180px] min-h-16 w-full resize-none bg-transparent px-3 py-2 outline-none disabled:opacity-70"
          placeholder={kbId ? `Ask ${AI_MODELS[model].name} about your documents…` : "Create/select a knowledge base first…"}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Enter to send · Shift+Enter for newline</span>
            <span className="hidden sm:inline">· {question.length}/4000</span>
          </div>
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary-hover"
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!question.trim() || !kbId || !conversationId}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </motion.section>
  );
}
