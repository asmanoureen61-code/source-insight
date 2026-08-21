# Source Insight

# Lovable Prompt — Animated Cream RAG Chatbot

Build production-ready **RAG AI Chatbot web app**. Premium, minimal, warm cream-white UI. Smooth animations. Desktop-first + fully responsive mobile.

## Dual-model runtime

Chat supports two server-routed generation models:

- `gpt-5.6-sol` → OpenAI Responses API
- `claude-opus` → Anthropic Messages API using `CLAUDE_OPUS_MODEL_ID`

Provider credentials are server-only. Configure deployment secrets from `.env.example`; never expose `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` through `VITE_*` variables.

Apply Supabase migrations before using chat so assistant messages can persist `model_used`.

## Product

App lets users:

* Sign up/login
* Create knowledge bases
* Upload documents
* Index documents into vector DB
* Chat with selected knowledge base
* Get AI answers grounded in uploaded docs
* See citations
* Open exact source used
* Manage docs
* Manage chat history
* Delete/re-index sources
* View indexing status

Core flow:

```text
Auth
→ Dashboard
→ Create Knowledge Base
→ Upload Document
→ Parse
→ Chunk
→ Embed
→ Index
→ Start Chat
→ Ask Question
→ Retrieve Relevant Chunks
→ LLM Answer
→ Citations
→ Source Preview
```

## Visual Direction

Style:

* Premium SaaS
* Warm
* Clean
* Calm
* Modern
* AI-focused
* Minimal
* Lots of whitespace
* Soft borders
* Soft shadows
* No aggressive gradients
* No neon
* No glassmorphism overload
* No generic purple AI theme

Design inspiration:

```text
Linear cleanliness
+
Notion simplicity
+
ChatGPT conversation UX
+
warm editorial cream palette
```

## Color System

Main background:

```css
--background: #FAF7F0;
```

Main surface:

```css
--surface: #FFFDF8;
```

Secondary cream:

```css
--cream-100: #F7F1E6;
--cream-200: #EFE6D7;
--cream-300: #E4D6C2;
```

Primary dark:

```css
--primary: #29251F;
--primary-hover: #171410;
```

Accent sage:

```css
--accent: #72856B;
--accent-light: #E8EEE5;
--accent-hover: #61755A;
```

Optional warm gold accent:

```css
--gold: #B58A50;
--gold-light: #F4E9D7;
```

Text:

```css
--text-primary: #28241F;
--text-secondary: #716A61;
--text-muted: #999187;
```

Borders:

```css
--border: #E8E0D5;
--border-strong: #D6CCBD;
```

Status:

```css
--success: #67805D;
--success-bg: #EDF3E9;

--warning: #B47C34;
--warning-bg: #FAF0DD;

--error: #B85C55;
--error-bg: #FAE9E7;

--info: #627C91;
--info-bg: #EAF0F4;
```

Never use pure:

```css
#FFFFFF
#000000
```

unless required for contrast.

## Typography

Use:

```text
Inter
```

Fallback:

```css
font-family: Inter, ui-sans-serif, system-ui, sans-serif;
```

Optional heading personality:

```text
DM Sans
```

Typography:

```text
Display: 40–48px / 600
H1: 32px / 600
H2: 24px / 600
H3: 18px / 600
Body: 15–16px / 400
Small: 13–14px
Caption: 12px
```

Keep text readable. No giant marketing headings inside app.

## Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 22px;
--radius-pill: 999px;
```

## Shadows

Soft only:

```css
--shadow-sm: 0 1px 3px rgba(46, 38, 28, 0.05);
--shadow-md: 0 8px 24px rgba(46, 38, 28, 0.07);
--shadow-lg: 0 18px 50px rgba(46, 38, 28, 0.09);
```

## Spacing

Use 4px grid.

```text
4
8
12
16
20
24
32
40
48
64
```

---

# App Shell

Desktop:

```text
┌──────────────────────────────────────────────────────────────┐
│ Sidebar │                    Main                            │
│         │                                                    │
│         │                                                    │
│         │                                                    │
└──────────────────────────────────────────────────────────────┘
```

Sidebar:

```text
240px
```

Collapsed:

```text
72px
```

Main max-width:

```text
1440px
```
