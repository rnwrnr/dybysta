# Going live with DYBYSTA (about 30–60 minutes)

## 1. Get an OpenAI API key (needed for JARVIS + mixed-language voice) — 5 min
1. Go to https://platform.openai.com → sign up → **Billing** → add a card and $10–20 of credit.
2. **API keys** → **Create new secret key** → copy it (starts with `sk-`). Keep it secret.
   Without a key the app still works, but uses the simple offline parser ("Simulated AI").

## 2. (Recommended) Create a Supabase project for real accounts — 10 min
Skip this for a pure demo: without Supabase every visitor gets a private demo stored in their own browser.
1. https://supabase.com → **New project** (region: Frankfurt is closest to Kazakhstan).
2. **SQL Editor** → run, in order: `supabase/migrations/0001_init.sql`, `0002_russian_ui.sql`, `0003_kazakh_voice.sql`.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
4. **Authentication → URL Configuration**: set **Site URL** to your live URL (from step 3) and add `https://YOUR-DOMAIN/auth/callback` to **Redirect URLs**.
   For a quick launch you can turn off "Confirm email" in **Authentication → Providers → Email** so people can sign in immediately.

## 3. Deploy on Vercel — 10 min
1. https://vercel.com → sign in with GitHub → **Add New → Project** → import `rnwrnr/dybysta`.
2. Before clicking Deploy, open **Environment Variables** and add:
   | Name | Value |
   | --- | --- |
   | `OPENAI_API_KEY` | your `sk-...` key |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase (optional) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase (optional) |
3. Click **Deploy**. In ~2 minutes you get a URL like `https://dybysta.vercel.app`.
4. (Optional) **Settings → Domains** → add your own domain (e.g. `dybysta.kz`) and follow the DNS instructions.
5. Every `git push` to `main` redeploys automatically.

## 4. Check before the presentation
- Open the site on a phone and a laptop. The microphone only works on **HTTPS** (Vercel gives you that) and in Chrome, Edge or Safari.
- Allow the microphone, say: "Ертең сағат 3-те профессорға позвонить ету керек, и создай категорию Entertainment".
- Open a note → **Change by voice** → "add: …".
- Switch EN / RU in the sidebar.

## 5. Accepting customers today
- **Sign-ups**: with Supabase configured, anyone can create an account on the live site.
- **Payments**: the app has no built-in payments yet. For launch day, the simplest option in Kazakhstan is a Kaspi QR / Kaspi Pay link or a Google Form for preorders, then giving access manually. Proper subscriptions (Kaspi Pay / CloudPayments / Stripe) can be added next.
- **Costs**: OpenAI usage for a typical user is a few cents per day. Set a monthly spending limit in OpenAI → Billing → Limits.

## Known limits
- Reminder notifications appear while the site is open in a tab (it can be in the background). Notifications when the browser is closed would need push notifications — a next step.
- The offline mode (no OpenAI key) understands only simple commands and one language at a time.
