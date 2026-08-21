import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createConversation,
  createKnowledgeBase,
  deleteConversation,
  deleteDocument,
  deleteKnowledgeBase,
  getConversation,
  getDocument,
  getKnowledgeBase,
  getOverview,
  getSettings,
  listConversations,
  listDocuments,
  listKnowledgeBases,
  purgeData,
  reindexDocumentFn,
  sendChatMessage,
  updateConversation,
  updateKnowledgeBase,
  updateProfile,
  updateSettings,
  uploadDocument,
} from "@/lib/api.functions";

type View = "dashboard" | "knowledge" | "documents" | "chats" | "chat" | "settings";
type AnyRow = Record<string, any>;

const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.22 },
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatBytes(value?: number | string | null) {
  const bytes = Number(value ?? 0);
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function statusTone(status: string) {
  if (status === "ready") return "bg-success-bg text-success";
  if (status === "failed") return "bg-error-bg text-error";
  if (status === "processing" || status === "queued") return "bg-warning-bg text-warning";
  return "bg-cream-100 text-muted-foreground";
}

function Badge({ status }: { status: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize", statusTone(status))}>
      {status === "ready" ? <Check className="h-3 w-3" /> : null}
      {(status === "processing" || status === "queued") ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {status === "failed" ? <CircleAlert className="h-3 w-3" /> : null}
      {status}
    </span>
  );
}

function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, title, text, action }: { icon: any; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="surface-card flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-light text-accent"><Icon className="h-5 w-5" /></div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function AuthScreen({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: name || email.split("@")[0] } } });
    setLoading(false);
    if (result.error) return setError(result.error.message);
    if (result.data.session) onReady();
    else if (mode === "signup") setError("Check your email to confirm your account, then sign in.");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-accent-light/70 blur-3xl animate-cream-float" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-gold-light/70 blur-3xl animate-cream-float" style={{ animationDelay: "-8s" }} />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-10 lg:grid-cols-[1.1fr_.9fr]">
        <div className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3"><BrandMark /><span className="font-display text-xl font-semibold">Verity</span></div>
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-accent">RAG knowledge assistant</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[1.05] tracking-tight">Your documents.<br />Answers you can verify.</h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">Build private knowledge bases, ask grounded questions, and open exact sources behind every answer.</p>
          <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-3">
            {[['Upload', Upload], ['Ask', MessageSquare], ['Verify', BookOpen]].map(([label, Icon]: any) => (
              <div key={label} className="surface-card p-4"><Icon className="mb-5 h-5 w-5 text-accent" /><p className="font-medium">{label}</p></div>
            ))}
          </div>
        </div>
        <motion.form {...pageMotion} onSubmit={submit} className="surface-card mx-auto w-full max-w-md p-6 sm:p-8">
          <div className="mb-7 lg:hidden"><div className="flex items-center gap-3"><BrandMark /><span className="font-display text-xl font-semibold">Verity</span></div></div>
          <h2 className="font-display text-2xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signin" ? "Sign in to your knowledge workspace." : "Start building a private source-grounded assistant."}</p>
          <div className="mt-7 space-y-4">
            {mode === "signup" ? <label className="block text-sm font-medium">Name<input className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-background px-3 outline-none focus:border-accent" value={name} onChange={(e) => setName(e.target.value)} /></label> : null}
            <label className="block text-sm font-medium">Email<input type="email" required className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-background px-3 outline-none focus:border-accent" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm font-medium">Password<input type="password" required minLength={6} className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-background px-3 outline-none focus:border-accent" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          </div>
          {error ? <div className="mt-4 rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning">{error}</div> : null}
          <PrimaryButton className="mt-6 w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{mode === "signin" ? "Sign in" : "Create account"}</PrimaryButton>
          <p className="mt-5 text-center text-sm text-muted-foreground">{mode === "signin" ? "New to Verity?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} className="font-medium text-foreground underline underline-offset-4">{mode === "signin" ? "Sign up" : "Sign in"}</button></p>
        </motion.form>
      </div>
    </div>
  );
}

function BrandMark() {
  return <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>;
}

export function RagApp() {
  const [session, setSession] = useState<any>(undefined);
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedKb, setSelectedKb] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [source, setSource] = useState<AnyRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  if (!session) return <AuthScreen onReady={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />;

  const navigate = (next: View) => { setView(next); setMobileNav(false); setSource(null); };
  const openKb = (id: string) => { setSelectedKb(id); navigate("knowledge"); };
  const openChat = async (id?: string | null, kbId?: string | null) => {
    let conversationId = id ?? null;
    if (!conversationId) {
      const created = await createConversation({ data: { kbId: kbId ?? null } } as any);
      conversationId = (created as any).id;
    }
    setSelectedConversation(conversationId);
    if (kbId) setSelectedKb(kbId);
    navigate("chat");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar open={sidebarOpen} mobileOpen={mobileNav} view={view} onNavigate={navigate} onToggle={() => setSidebarOpen((v) => !v)} onCloseMobile={() => setMobileNav(false)} onNewChat={() => openChat(null, selectedKb)} user={session.user} />
      <main className={cx("min-h-screen transition-[margin] duration-200", sidebarOpen ? "lg:ml-60" : "lg:ml-[72px]")}> 
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-cream-100 lg:hidden" onClick={() => setMobileNav(true)}><Menu className="h-5 w-5" /></button>
          <div className="hidden lg:block text-sm text-muted-foreground">Private workspace <span className="mx-2 text-border-strong">/</span> <span className="text-foreground capitalize">{view}</span></div>
          <div className="ml-auto flex items-center gap-2"><SecondaryButton onClick={() => openChat(null, selectedKb)}><Plus className="h-4 w-4" />New chat</SecondaryButton></div>
        </header>
        <div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {view === "dashboard" ? <Dashboard key="dashboard" refreshKey={refreshKey} onOpenKb={openKb} onOpenChat={(id, kb) => openChat(id, kb)} onCreateKb={() => navigate("knowledge")} /> : null}
            {view === "knowledge" ? <KnowledgeView key="knowledge" selectedKb={selectedKb} onSelectKb={setSelectedKb} onOpenChat={(kb) => openChat(null, kb)} onChanged={() => setRefreshKey((v) => v + 1)} /> : null}
            {view === "documents" ? <DocumentsView key="documents" onChanged={() => setRefreshKey((v) => v + 1)} /> : null}
            {view === "chats" ? <ChatsView key="chats" onOpen={(id, kb) => openChat(id, kb)} onChanged={() => setRefreshKey((v) => v + 1)} /> : null}
            {view === "chat" ? <ChatView key="chat" conversationId={selectedConversation} initialKbId={selectedKb} onSource={setSource} /> : null}
            {view === "settings" ? <SettingsView key="settings" user={session.user} /> : null}
          </AnimatePresence>
        </div>
      </main>
      <SourceDrawer source={source} onClose={() => setSource(null)} />
    </div>
  );
}
function Sidebar({ open, mobileOpen, view, onNavigate, onToggle, onCloseMobile, onNewChat, user }: any) {
  const nav = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["knowledge", "Knowledge Bases", FolderOpen],
    ["documents", "Documents", FileText],
    ["chats", "Chats", MessageSquare],
    ["settings", "Settings", Settings],
  ] as const;
  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-4"><BrandMark />{open || mobileOpen ? <span className="font-display text-lg font-semibold">Verity</span> : null}<button className="ml-auto hidden h-9 w-9 place-items-center rounded-xl hover:bg-cream-200 lg:grid" onClick={onToggle}>{open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}</button></div>
      <div className="px-3"><PrimaryButton onClick={onNewChat} className={cx("w-full", !open && !mobileOpen && "px-0")}><Plus className="h-4 w-4" />{open || mobileOpen ? "New chat" : null}</PrimaryButton></div>
      <nav className="mt-5 space-y-1 px-3">{nav.map(([id, label, Icon]) => <button key={id} onClick={() => onNavigate(id)} className={cx("flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition", view === id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-cream-200 hover:text-foreground", !open && !mobileOpen && "justify-center px-0")}><Icon className="h-4 w-4 shrink-0" />{open || mobileOpen ? label : null}</button>)}</nav>
      <div className="mt-auto border-t border-border p-3">
        <div className={cx("flex items-center gap-3 rounded-xl p-2", !open && !mobileOpen && "justify-center")}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-light text-accent"><User className="h-4 w-4" /></div>{open || mobileOpen ? <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.user_metadata?.display_name || user?.email?.split("@")[0]}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div> : null}{open || mobileOpen ? <button onClick={() => supabase.auth.signOut()} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-cream-200" title="Sign out"><LogOut className="h-4 w-4" /></button> : null}</div>
      </div>
    </div>
  );
  return <><aside className={cx("fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-sidebar transition-[width] duration-200 lg:block", open ? "w-60" : "w-[72px]")}>{content}</aside><AnimatePresence>{mobileOpen ? <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-primary/20 backdrop-blur-sm lg:hidden" onClick={onCloseMobile} /><motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-sidebar lg:hidden">{content}<button onClick={onCloseMobile} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl hover:bg-cream-200"><X className="h-4 w-4" /></button></motion.aside></> : null}</AnimatePresence></>;
}
function Dashboard({ refreshKey, onOpenKb, onOpenChat, onCreateKb }: any) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { getOverview().then(setData); }, [refreshKey]);
  if (!data) return <PageSkeleton />;
  const name = data.profile?.display_name || "there";
  const stats = [
    ["Knowledge bases", data.stats.knowledgeBases, FolderOpen],
    ["Indexed documents", data.stats.indexedDocuments, FileText],
    ["Conversations", data.stats.conversations, MessageSquare],
    ["Processing", data.stats.processing, Loader2],
  ] as const;
  return <motion.section {...pageMotion}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Workspace overview</p><h1 className="mt-1 font-display text-3xl font-semibold">Good to see you, {name}.</h1><p className="mt-1 text-muted-foreground">Manage knowledge and ask smarter questions.</p></div></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, Icon]) => <motion.div whileHover={{ y: -2 }} key={label} className="surface-card p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl font-semibold">{value}</p></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-light text-accent"><Icon className="h-4 w-4" /></div></div></motion.div>)}</div><SectionTitle title="Recent conversations" action={<button className="text-sm font-medium" onClick={() => onOpenChat(null, null)}>Start new</button>} />{data.recentConversations?.length ? <div className="surface-card divide-y divide-border overflow-hidden">{data.recentConversations.map((c: any) => <button key={c.id} onClick={() => onOpenChat(c.id, c.kb_id)} className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-cream-100"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cream-100"><MessageSquare className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate font-medium">{c.title}</p><p className="mt-0.5 text-xs text-muted-foreground">Updated {formatDate(c.updated_at)}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>)}</div> : <EmptyState icon={MessageSquare} title="No conversations yet" text="Ask your first question against a knowledge base." action={<PrimaryButton onClick={() => onOpenChat(null, null)}><Plus className="h-4 w-4" />Start chat</PrimaryButton>} />}<SectionTitle title="Knowledge bases" action={<button className="text-sm font-medium" onClick={onCreateKb}>Create new</button>} />{data.knowledgeBases?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.knowledgeBases.map((kb: any) => <motion.button whileHover={{ y: -2 }} key={kb.id} onClick={() => onOpenKb(kb.id)} className="surface-card p-5 text-left"><div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gold-light text-gold"><Database className="h-4 w-4" /></div><Badge status={kb.status} /></div><h3 className="mt-5 font-display text-lg font-semibold">{kb.name}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{kb.description || "Private source collection"}</p><div className="mt-5 flex items-center justify-between text-xs text-muted-foreground"><span>{kb.documentCount} documents</span><span>Updated {formatDate(kb.updated_at)}</span></div></motion.button>)}</div> : <EmptyState icon={FolderOpen} title="No knowledge bases" text="Create one, then add sources to start asking grounded questions." action={<PrimaryButton onClick={onCreateKb}><Plus className="h-4 w-4" />Create knowledge base</PrimaryButton>} />}</motion.section>;
}
function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) { return <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">{title}</h2>{action}</div>; }
function PageSkeleton() { return <div className="animate-pulse space-y-5"><div className="h-10 w-72 rounded-xl bg-cream-200" /><div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-cream-100" />)}</div><div className="h-72 rounded-2xl bg-cream-100" /></div>; }
function KnowledgeView({ selectedKb, onSelectKb, onOpenChat, onChanged }: any) {
  const [kbs, setKbs] = useState<any[]>([]); const [detail, setDetail] = useState<any>(null); const [creating, setCreating] = useState(false); const [uploading, setUploading] = useState(false);
  const load = async () => { const list = await listKnowledgeBases(); setKbs(list as any[]); const id = selectedKb || (list as any[])[0]?.id; if (id) { onSelectKb(id); setDetail(await getKnowledgeBase({ data: { id } } as any)); } else setDetail(null); };
  useEffect(() => { load(); }, [selectedKb]);
  async function removeKb() { if (!detail || !confirm(`Delete ${detail.kb.name}? This also deletes its documents and chats references.`)) return; await deleteKnowledgeBase({ data: { id: detail.kb.id } } as any); onSelectKb(null); onChanged(); await load(); }
  return <motion.section {...pageMotion}>{!detail ? <><div className="flex items-center justify-between"><div><h1 className="font-display text-3xl font-semibold">Knowledge bases</h1><p className="mt-1 text-muted-foreground">Organize sources into focused collections.</p></div><PrimaryButton onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create</PrimaryButton></div><div className="mt-7"><EmptyState icon={FolderOpen} title="Create your first knowledge base" text="Group related documents so retrieval stays focused and trustworthy." action={<PrimaryButton onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create knowledge base</PrimaryButton>} /></div></> : <><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-light text-gold"><Database className="h-5 w-5" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-3xl font-semibold">{detail.kb.name}</h1><Badge status={detail.kb.status} /></div><p className="mt-1 max-w-2xl text-muted-foreground">{detail.kb.description || "No description yet."}</p></div></div><div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New KB</SecondaryButton><SecondaryButton onClick={() => setUploading(true)}><Upload className="h-4 w-4" />Add source</SecondaryButton><PrimaryButton onClick={() => onOpenChat(detail.kb.id)}><MessageSquare className="h-4 w-4" />Start chat</PrimaryButton></div></div><div className="mt-7 flex gap-2 overflow-x-auto pb-1">{kbs.map((kb) => <button key={kb.id} onClick={() => onSelectKb(kb.id)} className={cx("whitespace-nowrap rounded-full px-3 py-1.5 text-sm", kb.id === detail.kb.id ? "bg-primary text-primary-foreground" : "border border-border bg-surface hover:bg-cream-100")}>{kb.name}</button>)}</div><div className="mt-6 grid gap-4 sm:grid-cols-4">{[["Documents", detail.stats.documents], ["Chunks", detail.stats.chunks], ["Storage", formatBytes(detail.stats.storage)], ["Last indexed", formatDate(detail.stats.lastIndexed)]].map(([k,v]) => <div className="surface-card p-4" key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 font-display text-xl font-semibold">{v}</p></div>)}</div><SectionTitle title="Sources" action={<button className="text-sm font-medium text-error" onClick={removeKb}>Delete knowledge base</button>} />{detail.documents.length ? <div className="surface-card overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Size</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Added</th><th className="px-4 py-3 font-medium"></th></tr></thead><tbody className="divide-y divide-border">{detail.documents.map((doc: any) => <DocumentRow key={doc.id} doc={doc} onChanged={async () => { await load(); onChanged(); }} />)}</tbody></table></div> : <EmptyState icon={FileText} title="No documents yet" text="Upload your first source to start asking grounded questions." action={<PrimaryButton onClick={() => setUploading(true)}><Upload className="h-4 w-4" />Upload document</PrimaryButton>} />}</>}{creating ? <CreateKbModal onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); onSelectKb(id); onChanged(); await load(); }} /> : null}{uploading && detail ? <UploadModal kbId={detail.kb.id} onClose={() => setUploading(false)} onUploaded={async () => { setUploading(false); onChanged(); await load(); }} /> : null}</motion.section>;
}
function CreateKbModal({ onClose, onCreated }: any) { const [name,setName]=useState(""); const [description,setDescription]=useState(""); const [busy,setBusy]=useState(false); async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);try{const kb:any=await createKnowledgeBase({data:{name,description}} as any);onCreated(kb.id);}finally{setBusy(false)}} return <Modal onClose={onClose} title="Create knowledge base"><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-background px-3" placeholder="Product docs" /></label><label className="block text-sm font-medium">Description<textarea maxLength={300} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-border-strong bg-background p-3" placeholder="What belongs in this collection?" /></label><div className="flex justify-end gap-2"><SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={busy}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:null}Create</PrimaryButton></div></form></Modal>; }
function UploadModal({ kbId, onClose, onUploaded }: any) { const [type,setType]=useState<"file"|"url"|"text">("file"); const [title,setTitle]=useState(""); const [url,setUrl]=useState(""); const [text,setText]=useState(""); const [file,setFile]=useState<File|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); async function toBase64(f:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.readAsDataURL(f);});} async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{let fileBase64:string|undefined;if(file) fileBase64=await toBase64(file);await uploadDocument({data:{kbId,sourceType:type,title:title||file?.name||"Untitled source",text:type==="text"?text:undefined,url:type==="url"?url:undefined,fileName:file?.name,mimeType:file?.type,fileBase64}} as any);onUploaded();}catch(err:any){setError(err?.message||"Upload failed");}finally{setBusy(false)}} return <Modal onClose={onClose} title="Add knowledge source"><div className="mb-5 grid grid-cols-3 gap-2">{(["file","url","text"] as const).map(t=><button key={t} onClick={()=>setType(t)} className={cx("rounded-xl border px-3 py-2 text-sm font-medium capitalize",type===t?"border-accent bg-accent-light text-accent":"border-border bg-surface")}>{t}</button>)}</div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Title<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-background px-3" placeholder="Optional source title" /></label>{type==="file"?<label className="block cursor-pointer rounded-2xl border border-dashed border-border-strong bg-cream-100 p-7 text-center"><Upload className="mx-auto h-6 w-6 text-accent"/><p className="mt-3 font-medium">{file?file.name:"Drop or choose a file"}</p><p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT, MD, CSV · max 10 MB</p><input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.csv" onChange={e=>setFile(e.target.files?.[0]||null)} /></label>:null}{type==="url"?<label className="block text-sm font-medium">Website URL<input required type="url" value={url} onChange={e=>setUrl(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-background px-3" placeholder="https://example.com/docs" /></label>:null}{type==="text"?<label className="block text-sm font-medium">Text<textarea required value={text} onChange={e=>setText(e.target.value)} className="mt-1.5 min-h-40 w-full rounded-xl border border-border-strong bg-background p-3" placeholder="Paste source text..." /></label>:null}{error?<div className="rounded-xl bg-error-bg p-3 text-sm text-error">{error}</div>:null}<div className="flex justify-end gap-2"><SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={busy || (type==="file"&&!file)}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Upload className="h-4 w-4"/>}{busy?"Indexing...":"Add & index"}</PrimaryButton></div></form></Modal>; }
function Modal({ title, onClose, children }: any) { return <div className="fixed inset-0 z-[70] grid place-items-center bg-primary/20 p-4 backdrop-blur-sm"><motion.div initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} className="surface-card max-h-[90vh] w-full max-w-lg overflow-auto p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">{title}</h2><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-cream-100"><X className="h-4 w-4"/></button></div>{children}</motion.div></div>; }
function DocumentRow({ doc, onChanged }: any) { const [busy,setBusy]=useState(false); async function reindex(){setBusy(true);try{await reindexDocumentFn({data:{id:doc.id}} as any);await onChanged();}finally{setBusy(false)}} async function remove(){if(!confirm(`Delete ${doc.title}?`))return;await deleteDocument({data:{id:doc.id}} as any);onChanged();} return <tr className="hover:bg-cream-100/60"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-cream-100"><FileText className="h-4 w-4"/></div><div><p className="font-medium">{doc.title}</p><p className="text-xs text-muted-foreground">{doc.file_name||doc.source_url||doc.source_type}</p></div></div></td><td className="px-4 py-3 capitalize text-muted-foreground">{doc.source_type}</td><td className="px-4 py-3 text-muted-foreground">{formatBytes(doc.size_bytes)}</td><td className="px-4 py-3"><Badge status={doc.status}/></td><td className="px-4 py-3 text-muted-foreground">{formatDate(doc.created_at)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={reindex} disabled={busy} title="Re-index" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-cream-200">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<RefreshCw className="h-4 w-4"/>}</button><button onClick={remove} title="Delete" className="grid h-9 w-9 place-items-center rounded-lg text-error hover:bg-error-bg"><Trash2 className="h-4 w-4"/></button></div></td></tr>; }
function DocumentsView({ onChanged }: any) { const [data,setData]=useState<any>(null); const [query,setQuery]=useState(""); const load=()=>listDocuments().then(setData); useEffect(()=>{load()},[]); if(!data)return <PageSkeleton/>; const kbMap=new Map((data.knowledgeBases||[]).map((k:any)=>[k.id,k.name])); const docs=(data.documents||[]).filter((d:any)=>`${d.title} ${d.file_name||""}`.toLowerCase().includes(query.toLowerCase())); return <motion.section {...pageMotion}><div><h1 className="font-display text-3xl font-semibold">Documents</h1><p className="mt-1 text-muted-foreground">All indexed sources across your workspace.</p></div><div className="mt-6 flex max-w-md items-center gap-2 rounded-xl border border-border-strong bg-surface px-3"><Search className="h-4 w-4 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} className="h-11 flex-1 bg-transparent outline-none" placeholder="Search documents"/></div><div className="mt-5">{docs.length?<div className="surface-card overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 font-medium">Knowledge base</th><th className="px-4 py-3 font-medium">Size</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Added</th><th/></tr></thead><tbody className="divide-y divide-border">{docs.map((d:any)=><tr key={d.id} className="hover:bg-cream-100/60"><td className="px-4 py-3"><p className="font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.file_name||d.source_type}</p></td><td className="px-4 py-3 text-muted-foreground">{kbMap.get(d.kb_id)||"—"}</td><td className="px-4 py-3 text-muted-foreground">{formatBytes(d.size_bytes)}</td><td className="px-4 py-3"><Badge status={d.status}/></td><td className="px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td><td className="px-4 py-3"><DocumentActions doc={d} onChanged={async()=>{await load();onChanged();}}/></td></tr>)}</tbody></table></div>:<EmptyState icon={FileText} title="No matching documents" text="Sources you upload to knowledge bases appear here."/>}</div></motion.section>; }
function DocumentActions({doc,onChanged}:any){const [busy,setBusy]=useState(false);return <div className="flex justify-end gap-1"><button onClick={async()=>{setBusy(true);try{await reindexDocumentFn({data:{id:doc.id}} as any);onChanged();}finally{setBusy(false)}}} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-cream-200">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<RefreshCw className="h-4 w-4"/>}</button><button onClick={async()=>{if(confirm(`Delete ${doc.title}?`)){await deleteDocument({data:{id:doc.id}} as any);onChanged();}}} className="grid h-9 w-9 place-items-center rounded-lg text-error hover:bg-error-bg"><Trash2 className="h-4 w-4"/></button></div>}
function ChatsView({ onOpen, onChanged }: any) { const [data,setData]=useState<any>(null);const [q,setQ]=useState("");const load=()=>listConversations().then(setData);useEffect(()=>{load()},[]);if(!data)return <PageSkeleton/>;const kbMap=new Map((data.knowledgeBases||[]).map((k:any)=>[k.id,k.name]));const items=(data.conversations||[]).filter((c:any)=>c.title.toLowerCase().includes(q.toLowerCase()));return <motion.section {...pageMotion}><div><h1 className="font-display text-3xl font-semibold">Chat history</h1><p className="mt-1 text-muted-foreground">Continue, pin, rename, or remove conversations.</p></div><div className="mt-6 flex max-w-md items-center gap-2 rounded-xl border border-border-strong bg-surface px-3"><Search className="h-4 w-4 text-muted-foreground"/><input value={q} onChange={e=>setQ(e.target.value)} className="h-11 flex-1 bg-transparent outline-none" placeholder="Search chats"/></div><div className="mt-5 space-y-2">{items.length?items.map((c:any)=><div key={c.id} className="surface-card flex items-center gap-4 p-4"><button onClick={()=>onOpen(c.id,c.kb_id)} className="flex min-w-0 flex-1 items-center gap-4 text-left"><div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-light text-accent"><MessageSquare className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="truncate font-medium">{c.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{kbMap.get(c.kb_id)||"No knowledge base"} · {formatDate(c.updated_at)}</p></div></button><button title={c.pinned?"Unpin":"Pin"} onClick={async()=>{await updateConversation({data:{id:c.id,pinned:!c.pinned}} as any);load();}} className={cx("grid h-9 w-9 place-items-center rounded-lg hover:bg-cream-100",c.pinned&&"text-gold")}><Sparkles className="h-4 w-4"/></button><button onClick={async()=>{if(confirm(`Delete ${c.title}?`)){await deleteConversation({data:{id:c.id}} as any);onChanged();load();}}} className="grid h-9 w-9 place-items-center rounded-lg text-error hover:bg-error-bg"><Trash2 className="h-4 w-4"/></button></div>):<EmptyState icon={MessageSquare} title="No conversations" text="Start a chat to create your first conversation."/>}</div></motion.section>; }
function ChatView(props: any) {
  const [Component, setComponent] = useState<any>(null);
  useEffect(() => {
    let active = true;
    import("./ai-chat-view").then((module) => {
      if (active) setComponent(() => module.AIChatView);
    });
    return () => { active = false; };
  }, []);
  if (!Component) return <PageSkeleton />;
  return <Component {...props} />;
}
function SourceDrawer({ source, onClose }: any) { const [doc,setDoc]=useState<any>(null); useEffect(()=>{if(source?.document_id)getDocument({data:{id:source.document_id}} as any).then(setDoc).catch(()=>setDoc(null));else setDoc(null)},[source]); return <AnimatePresence>{source?<><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-[1px]" onClick={onClose}/><motion.aside initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{duration:.25}} className="fixed inset-y-0 right-0 z-60 w-full max-w-md border-l border-border bg-surface shadow-lg"><div className="flex h-16 items-center justify-between border-b border-border px-5"><div><p className="text-xs text-muted-foreground">Source [{source.marker}]</p><h2 className="font-display font-semibold">{source.document_title}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-cream-100"><X className="h-4 w-4"/></button></div><div className="h-[calc(100vh-64px)] overflow-auto p-5"><div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{source.page_number?<span className="rounded-full bg-cream-100 px-2 py-1">Page {source.page_number}</span>:null}{source.section?<span className="rounded-full bg-cream-100 px-2 py-1">{source.section}</span>:null}</div><div className="mt-5 rounded-2xl border border-border bg-accent-light/50 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Retrieved passage</p><p className="whitespace-pre-wrap text-sm leading-6">{source.excerpt}</p></div>{doc?.content?<div className="mt-6"><p className="mb-2 text-sm font-semibold">Document preview</p><div className="max-h-[45vh] overflow-auto rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted-foreground scrollbar-slim">{doc.content}</div></div>:null}</div></motion.aside></>:null}</AnimatePresence>; }
function SettingsView({ user }: any) { const [data,setData]=useState<any>(null); const [form,setForm]=useState<any>({}); const [name,setName]=useState(""); const [saved,setSaved]=useState(false); useEffect(()=>{getSettings().then((d:any)=>{setData(d);setForm(d.settings||{});setName(d.profile?.display_name||"");})},[]); if(!data)return <PageSkeleton/>; async function save(){await Promise.all([updateSettings({data:{workspace_name:form.workspace_name,response_length:form.response_length,citation_style:form.citation_style,model:form.model,top_k:Number(form.top_k),similarity_threshold:Number(form.similarity_threshold),retention_days:Number(form.retention_days),default_kb_id:form.default_kb_id||null}} as any),name?updateProfile({data:{display_name:name}} as any):Promise.resolve()]);setSaved(true);setTimeout(()=>setSaved(false),1800)} return <motion.section {...pageMotion} className="max-w-3xl"><div><h1 className="font-display text-3xl font-semibold">Settings</h1><p className="mt-1 text-muted-foreground">Workspace, AI behavior, and data controls.</p></div><div className="mt-7 space-y-5"><SettingsCard title="General" subtitle="Workspace identity and defaults"><Field label="Display name"><input value={name} onChange={e=>setName(e.target.value)} className="input"/></Field><Field label="Workspace name"><input value={form.workspace_name||""} onChange={e=>setForm({...form,workspace_name:e.target.value})} className="input"/></Field><Field label="Default knowledge base"><select value={form.default_kb_id||""} onChange={e=>setForm({...form,default_kb_id:e.target.value||null})} className="input"><option value="">None</option>{data.knowledgeBases.map((kb:any)=><option key={kb.id} value={kb.id}>{kb.name}</option>)}</select></Field></SettingsCard><SettingsCard title="AI" subtitle="Tune response and retrieval behavior"><div className="grid gap-4 sm:grid-cols-2"><Field label="Response length"><select value={form.response_length||"balanced"} onChange={e=>setForm({...form,response_length:e.target.value})} className="input"><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></Field><Field label="Citation style"><select value={form.citation_style||"inline"} onChange={e=>setForm({...form,citation_style:e.target.value})} className="input"><option value="inline">Inline</option><option value="footnote">Footnote</option></select></Field><Field label="Top K"><input type="number" min={1} max={20} value={form.top_k||6} onChange={e=>setForm({...form,top_k:e.target.value})} className="input"/></Field><Field label="Similarity threshold"><input type="number" min={0} max={1} step="0.05" value={form.similarity_threshold??.15} onChange={e=>setForm({...form,similarity_threshold:e.target.value})} className="input"/></Field></div></SettingsCard><SettingsCard title="Data" subtitle="Destructive actions require confirmation"><div className="flex flex-wrap gap-2"><SecondaryButton onClick={async()=>{if(confirm("Delete all chat history?"))await purgeData({data:{target:"chats"}} as any)}}><Trash2 className="h-4 w-4"/>Delete chats</SecondaryButton><SecondaryButton onClick={async()=>{if(confirm("Delete all documents? This removes indexed chunks too."))await purgeData({data:{target:"documents"}} as any)}}><Trash2 className="h-4 w-4"/>Delete documents</SecondaryButton></div></SettingsCard><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Signed in as {user.email}</p><PrimaryButton onClick={save}>{saved?<Check className="h-4 w-4"/>:null}{saved?"Saved":"Save changes"}</PrimaryButton></div></div></motion.section>; }
function SettingsCard({title,subtitle,children}:any){return <div className="surface-card p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p><div className="mt-5 space-y-4">{children}</div></div>}
function Field({label,children}:any){return <label className="block text-sm font-medium">{label}<div className="mt-1.5">{children}</div></label>}
