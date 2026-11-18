# DYBYSTA

A personal AI assistant that helps you remember tasks, ideas, notes and commitments through natural language and voice.

> **AI should be proactive — but the user stays the boss.** Nothing AI-generated is saved until you approve it, every interpretation is shown, and missing details are asked for instead of invented.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — the app works without any keys
npm run dev
```

Open http://localhost:3000.

| Configuration | Behaviour |
| --- | --- |
| No keys | **Demo mode.** Enter with just a name; data lives in `localStorage` (seeded with sample items); AI uses the built-in parser and is labeled **Simulated AI**. |
| Supabase keys | Real email/password accounts; data stored in Postgres with Row Level Security. |
| `OPENAI_API_KEY` | Live AI capture, assistant and daily overview (default model `gpt-4o-mini`, set `OPENAI_MODEL` to change). Falls back to the offline parser, clearly labeled, if the API fails. |

### Supabase setup

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql`, then `0002_russian_ui.sql`, in the SQL editor (or `supabase db push`).
3. Put the project URL and anon key in `.env.local`.
4. In Auth → URL configuration, add `http://localhost:3000/auth/callback` (and your production URL) as a redirect URL for email confirmation.

The migration creates `profiles`, `user_preferences`, `categories`, `tasks`, `reminders`, `notes`, `ideas`, `events`; RLS policies so `auth.uid() = user_id` on every table; a signup trigger that creates the profile, preferences and default categories; and a `delete_my_account()` RPC.

## Features

- **Dashboard**: greeting, quick capture, stat tiles, AI daily overview, overdue, today, upcoming reminders, upcoming commitments, recent notes and ideas.
- **AI Quick Capture**: type or speak. Classifies into task, reminder, idea, note or event and extracts title, description, date, time, priority, category, tags and repeat. A review card shows each AI-filled field (✨), lists the AI's interpretations (e.g. "Interpreted '3' as 15:00"), and asks for clarification when something required is missing (a reminder without a time can't be saved). You can change the type and every field before saving. Open it anywhere with **C** or **⌘K**.
- **Voice**: Web Speech API with live interim transcription, an editable transcript, and an English/Russian toggle next to the mic. Permission, no-speech and unsupported-browser errors are handled.
- **Tasks**: create, edit, delete and complete tasks, with priorities, due date and time, categories, search, status/priority/category filters, sorting, grouped list and calendar views, and overdue indicators.
- **Reminders**: in-app notifications every 15 s while the app is open, plus optional browser notifications, a sound, and quiet hours. Snooze for 10 min to tomorrow, dismiss or mark done; repeating reminders (daily/weekdays/weekly/monthly) move to their next time. The bell menu is the notification center.
- **Ideas**: tags, categories, status, search, and convert to a task.
- **Notes**: folders, tags, pinning, search, autosave, and convert to a task or reminder.
- **Calendar**: month and week views showing events, tasks and reminders, with type and category filters. Add items from any day.
- **Assistant**: chat grounded only in your saved items. It cites the items it used (clickable) and says when it can't find something.
- **Settings**: profile, voice and AI language, week start, notification controls, AI and privacy explanation, category management, JSON/CSV export, and delete items or account.

## Languages (English / Русский)

- The whole interface is available in English and Russian. Switch it in the sidebar (EN / RU) or in **Settings → Language**. The choice is saved to your preferences and a cookie. On first visit, the language is detected from the browser (Russian and Kazakh browsers get Russian).
- Dates use Russian formatting ("Завтра, 15:00").
- The simulated AI (capture explanations, assistant, daily overview) answers in Russian. With OpenAI, explanations follow the interface language. The assistant follows **AI response language** in Settings, which defaults to the language of your question.
- New Russian-language accounts and demo sessions get Russian category names and sample data.
- Translations live in `src/lib/i18n/ru.ts`, keyed by the English text. A missing key falls back to English. Components use `const { t } = useT()`.

## Architecture

```
src/
  app/
    (auth)/login, signup     auth pages (Supabase, or demo entry)
    (app)/...                dashboard, tasks, reminders, calendar, ideas, notes, assistant, settings
    api/ai/{capture,assistant,overview,status}   server routes (auth-guarded, rate-limited, zod-validated)
    auth/callback            email-confirmation code exchange
  components/
    ui/                      shadcn/ui components (Radix + Tailwind)
    app/                     shell, dialogs provider, notification center, reminder scheduler
    capture/                 composer, review card, voice controls
    calendar/, items/, dashboard/
  lib/
    data/                    DataBackend interface → SupabaseBackend | DemoBackend, React DataProvider
    ai/                      OpenAI client (structured outputs + anti-fabrication guard),
                             heuristic EN/RU parser, simulated assistant/overview, context builder
  middleware.ts              session refresh + route protection (Supabase mode)
supabase/migrations/         schema + RLS
```

**Anti-fabrication:** the OpenAI capture schema requires `date_evidence` / `time_evidence` / `priority_evidence` quoted from the user's own words. The server drops any value whose evidence isn't in the input and turns it into a clarification question.

**Timezones:** the client sends its local wall-clock date and time, so relative dates ("tomorrow at 3") resolve in the user's timezone whatever the server's timezone is.

## Notes

- Notifications fire while DYBYSTA is open in a tab (it can be a background tab). Push delivery when the app is closed would need a service worker and a server scheduler.
- Speech recognition depends on the browser: Chrome, Edge and Safari support it; Firefox does not.
- When Supabase is not configured, the AI routes are not behind authentication. Don't deploy with an OpenAI key in that setup.
