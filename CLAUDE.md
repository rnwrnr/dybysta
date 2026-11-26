# DYBYSTA — project briefing for Claude

DYBYSTA is a voice-first "second brain" web app (tasks, reminders, notes, ideas, events, calendar, AI assistant).
The owner is preparing to launch to customers in Kazakhstan. They are not a programmer: give click-by-click instructions,
keep explanations simple, and do the technical work yourself.

## Product decisions (made by the owner — keep them)
- AI acts like JARVIS: it executes instructions itself (create/edit/delete/move items, create categories) and never asks for confirmation. Every action can be undone (Undo button).
- Everything is auto-saved and auto-organized: each item gets a topic category (new categories created when nothing fits); notes also get a folder.
- Voice is the main feature: big microphone on the dashboard; voice editing inside tasks/notes ("Change by voice").
- Mixed Kazakh + Russian + English speech in one sentence (needs a server AI key; browser fallback is one language at a time: EN/RU/KZ).
- Design: beige/sand palette (no purple), larger fonts, simple uncluttered pages.
- Full English and Russian interface (switch in sidebar / Settings).
- Pricing discussed: 1,990 ₸/month, 17,990 ₸/year, launch offer 990 ₸/month for the first year. Payments are NOT built yet (plan: Kaspi).

## Stack & structure
Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui-style components (hand-written in `src/components/ui`, the shadcn registry was unreachable) + Supabase + OpenAI SDK.
- `src/lib/data/` — `DataBackend` interface: `SupabaseBackend` (real accounts, RLS) or `DemoBackend` (localStorage) when Supabase env vars are missing. `store.tsx` = React `DataProvider` (`useData()`).
- `src/lib/ai/agent-openai.ts` — tool-calling agent; tools are NOT executed on the server, they are returned as actions. `src/components/app/agent.ts` (`useAgent()`) executes actions in the browser and supports undo. `agent-heuristic.ts` = offline fallback (no AI key).
- `src/app/api/ai/` — `agent`, `transcribe` (OpenAI-compatible speech-to-text), `overview`, `status`, plus older `capture`/`assistant`.
- `src/hooks/use-voice-input.ts` — records audio → `/api/ai/transcribe` when an AI key exists, else browser speech recognition.
- `src/lib/i18n/` — translations keyed by English text; Russian in `ru.ts`. Components use `const { t } = useT()`. Add a Russian entry for every new UI string.
- `supabase/setup.sql` — whole database in one file (= migrations 0001–0004). New schema changes: add `0005_...sql` AND update `setup.sql`. Newer Supabase projects need explicit GRANTs (see 0004) — include grants for any new table.
- `DEPLOY.md` — launch steps for the owner.

## Deployment (live)
- GitHub: `rnwrnr/dybysta` (private), branch `main`. Vercel auto-deploys every push to `main`.
- Vercel env vars currently use **Groq** (free) through the OpenAI SDK:
  `OPENAI_API_KEY=gsk_...`, `OPENAI_BASE_URL=https://api.groq.com/openai/v1`, `OPENAI_MODEL=llama-3.3-70b-versatile`, `OPENAI_TRANSCRIBE_MODEL=whisper-large-v3`,
  plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  To switch to OpenAI later: set `OPENAI_API_KEY=sk-...`, delete `OPENAI_BASE_URL`, `OPENAI_MODEL=gpt-4o-mini`, `OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe`, then Redeploy.
- Supabase: Site URL + Redirect URLs (`/auth/callback` and `/**`) must point to the Vercel domain. "Confirm email" was turned off for launch.

## Working rules
- Run `npx tsc --noEmit`, `npm run lint` and `npm run build` before pushing; test UI flows with Playwright against `npm start` (demo mode works without any keys).
- Commit and push to `main` when a change is done and tested (the owner relies on auto-deploy).
- Never commit secrets. `.env.local` is git-ignored.

## Known gaps / next steps
- Payments/subscriptions (Kaspi Pay, CloudPayments or Stripe) and a free-tier usage limit.
- Push notifications when the browser is closed (reminders currently fire only while a tab is open).
- Custom email sender for Supabase (built-in sender is rate-limited).
- Real Supabase + Groq/OpenAI flows have not been tested from the dev container (its network blocks outside services); the owner tests on the live site.
