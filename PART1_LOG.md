# Part 1 · Flat — work log

Running log of everything done for **Part 1** in `TASKS.md` (onboarding, home, platform), with the reasoning behind each change.
Status: `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run build` ✅ (built without env vars; untested against a live Supabase until step 1 is done).

---

## Task checklist

| # | Task | Status |
|---|---|---|
| 1 | Supabase project, run `schema.sql`, share `.env.local`, deploy to Vercel | ⏳ **You need to do this** (needs your accounts), see [Setup steps](#setup-steps-task-1) |
| 2 | `createFlat`, `findFlatByCode`, `joinFlat` → Landing + Join | ✅ |
| 3 | Settings: invite link + QR, buyout rate editor | ✅ |
| 4 | Home: real `getBalances` / `getOpenTasks` / `getOpenBounties` | ✅ wired, with automatic fallback until Split/Chores implement them |
| 5 | Activity feed (expenses + completed chores, merged by date) | ✅ |
| 6 | Seed script for the demo flat + rehearsal | ✅ `supabase/seed.sql` (rehearsal is on the team) |

---

## Setup steps (task 1)

1. **Supabase:** create a project at supabase.com (free tier).
   - SQL editor → paste `supabase/schema.sql` → Run.
   - SQL editor → paste `supabase/seed.sql` → Run (demo flat, invite code **GWRST4**).
   - Project Settings → API → copy the **Project URL** and **anon/publishable key**.
2. **Env:** `cp .env.example .env.local` and fill in both values. Send them to the team privately (never commit `.env.local`; `.gitignore` already blocks `.env*`).
3. **Run:** `npm install && npm run dev` → http://localhost:3000.
4. **Vercel:** import the GitHub repo at vercel.com/new, add the same two env vars, deploy. The QR code uses `window.location.origin`, so it automatically points to the Vercel URL once you open the app there. **Show the QR from the deployed site, not localhost**, otherwise judges' phones can't open it.

---

## Changes, file by file

### `src/features/flat/api.ts`: implemented
- **`createFlat`** inserts a `flats` row with `generateInviteCode()`, then calls `joinFlat` for the creator.
  *Why the retry loop:* `invite_code` is `UNIQUE`; on a collision Postgres returns error `23505`, so we retry with a new code (up to 5 times). That's 32⁶ ≈ 1 billion codes, so it's basically never needed, but it's cheap insurance.
- **`findFlatByCode`** upper-cases and trims the code (codes are stored upper-case), uses `maybeSingle()` so "not found" returns `null` instead of throwing, and also returns the members (the Join screen shows the avatar stack).
- **`joinFlat`** inserts the member and calls `setMemberId` so the device remembers who you are (no passwords, as in the IDEA).
- **`normaliseHandle`** (private): people paste their payment handle in many forms (`@alex`, `monzo.me/alex`, `https://paypal.me/priya`). It's normalised to what `payLink()` in `lib/money.ts` expects: `alex` or `paypal:priya`.
- **`updateBuyoutRate`** validates positive integer pence, then updates `flats`.
- **`getActivity`** *(new, task 5)* fetches the latest expenses and the latest completed `chore_tasks` (joined to `chores` for the title) in parallel, merges them, sorts them by date and trims to `limit`. It returns a typed union (`kind: "expense" | "chore"`), so the UI decides the wording.
  *Why it lives in Flat even though it reads Split/Chores tables:* it's read-only and TASKS.md gives the feed to Part 1. It doesn't write to anyone else's tables.

### `src/features/flat/LandingScreen.tsx`
- The inputs are now controlled, inside real `<form>`s, so Enter submits on mobile keyboards.
- **Create** → `createFlat` → goes to **`/flat/<id>/settings`**. *Why settings, not home:* the first thing a new flat needs is to invite people, and the QR code lives there.
- **Join** → goes to `/join/<CODE>`, so there's one join flow (the Join screen does the lookup) instead of two.
- Added the optional Monzo.me field to Create (the creator also needs to get paid back).
- Busy state ("Creating…"), disabled buttons until the fields are valid, and inline errors in `text-negative`.
- The "Peek at a demo flat" link is still there.

### `src/features/flat/JoinScreen.tsx`
- Looks up the flat by code, with three states: loading → not found (an `EmptyState` plus a link back) → found.
- **Auto-skip:** if this device is already a member of the flat, it redirects straight in.
- **"Already in this flat? Tap your name"** *(new)*: tapping a member chip sets the localStorage identity and enters the flat.
  *Why:* identity lives only in localStorage, so changing phone, clearing storage or opening the seeded demo flat would otherwise force you to create a duplicate member. For the demo, the presenter opens `/join/GWRST4` and taps **Alex**. (It's hackathon-level trust, the same as the rest of the auth model.)
- The flatmate count now handles singular and plural.

### `src/features/flat/SettingsScreen.tsx`
- **Buyout rate editor:** tapping the "Price per effort point" row opens a `Sheet` (per DESIGN.md: forms go in sheets). It parses with `parsePounds`, saves pence, and shows a live preview ("A 5-point bathroom clean would cost £5.00"). After saving it calls `reload()` from the flat context. The demo flat is read-only and shows a friendly error.
  *`key={flat.buyout_rate_pence}`* on the sheet resets its input when the rate changes (including from another phone via realtime).
- **Copy invite link** now shows "Copied ✓" for 2 seconds, and fails silently if the clipboard is blocked (the code is visible on screen anyway).

### `src/features/flat/HomeScreen.tsx`
- **Demo flat** (`/flat/demo`): same demo data as before.
- **Real flat:** calls `getBalances` (Split), `getOpenTasks(flat, me)` / `getOpenBounties` (Chores) and `getActivity` (ours) in parallel.
- **`soft()` wrapper:** each teammate call is wrapped. While their function still throws `TODO(...)`, that section shows an empty state and the info is logged to the console. *Why:* Home works today and lights up section by section as Split and Chores land, with no code change and no blocking each other.
- **Realtime:** `useRealtime(flat.id, ["expenses","settlements","chore_tasks","bounties"], load)`, so Home updates live when anyone adds an expense, finishes a chore or posts a bounty.
- Small UX additions: "You're all square" when the balance is £0, an "All chores" link on the section, bounties link to the Chores tab, completed chores get a green tick in the feed, and friendly `EmptyState` copy.

### `src/lib/useRealtime.ts`: bug fix
- The hook filtered every table with `flat_id=eq.<id>`, but **`flats` has no `flat_id` column** (its key is `id`). `FlatProvider` subscribes to `flats`, so flat renames and buyout-rate changes never arrived live. `flats` now uses `id=eq.<id>`.

### `supabase/seed.sql`: new (task 6)
- A single idempotent `DO` block: it deletes the demo flat (cascade) and recreates it, so you can **re-run it between rehearsals to reset**.
- Fixed UUIDs for the flat and members; invite code **GWRST4**.
- The data tells the demo story from IDEA.md §10:
  - 4 flatmates: Alex (presenter, Monzo), Sam, Priya (PayPal), Tom (no handle, which shows the "No payment link" state).
  - Fairness over 28 days: **Sam 9 · Alex 6 · Priya 6 · Tom 3**, so Tom is the obvious next assignee when bins get marked done.
  - A past buyout: Tom did Sam's bathroom clean for £5. The task has `points_credited_to = Sam`, plus the matching `Buyout:` expense (paid by Tom, 100% owed by Sam) and an accepted bounty.
  - An open £3 bounty from Priya on the hoovering (raised from the £2 base, which shows "raise bounty").
  - Alex has an open **bathroom** task, which is the live "I've got exams" buyout.
  - Expenses covering all three split modes, two recurring bills (Wi-Fi, Energy) with linked occurrences, and a settlement (Sam → Alex £10).
  - Every `expense_shares` set sums exactly to its expense total (integer pence).

---

## Notes for teammates
- **Contracts used by Home:** `getBalances(flatId, meId)`, `getOpenTasks(flatId, assignedTo)`, `getOpenBounties(flatId)`. Signatures unchanged. Once these are implemented, Home picks them up automatically.
- **Seed assumption for Chores:** for recurring chores, `next_due_at` is the due date of the *next* task to generate (after the currently open one). If `catchUpChores` uses a different convention, tell me and I'll adjust the seed.
- **Not done / ideas if time allows:** editing your own name or pay handle in Settings, and leaving a flat. Activity currently shows expenses and chores; settlements and bounties could be added to `getActivity` in a few lines.

---

## Best free setup for Claude frontend design

From most to least impact for this project:

### 1. Let Claude *see* the UI (biggest win)
Claude designs much better when it can screenshot its own output and critique it.
- **Playwright MCP** (free, by Microsoft):
  ```bash
  claude mcp add playwright -- npx @playwright/mcp@latest
  ```
  Then ask: *"Run the dev server, open /flat/demo at 390×844, screenshot every tab, critique the spacing and hierarchy, fix it, and re-screenshot."*
- Or the built-in **`claude-in-chrome`** skill (already available in this session), which drives your real Chrome.
- The built-in **`run`** skill launches the app and confirms changes visually.

### 2. Anthropic's `frontend-design` skill (free, official)
It pushes Claude away from generic "AI-looking" UI and towards deliberate typography, colour, motion and layout choices.
```bash
# inside Claude Code
/plugin marketplace add anthropics/claude-code
/plugin install frontend-design@claude-code-plugins
```
(It's also in the open-source `anthropics/skills` repo on GitHub if you'd rather copy it into `.claude/skills/`.)
⚠️ For this repo, tell it to **stay inside DESIGN.md tokens and `ui.tsx`**. Its instinct is to restyle boldly, and the team rule is no hard-coded colours.

### 3. Up-to-date docs
- `AGENTS.md` warns that this Next.js (16.4) differs from training data. The docs ship in `node_modules/next/dist/docs/`, so point Claude there.
- **Context7 MCP** (free) pulls current docs for Next, Tailwind v4, Supabase and lucide:
  ```bash
  claude mcp add context7 -- npx -y @upstash/context7-mcp
  ```

### 4. A `CLAUDE.md` so every session starts with the rules
Run `/init` or create `CLAUDE.md` with something like:
```md
@AGENTS.md
@DESIGN.md
- Mobile-first: always check at 390px wide.
- Build screens only from src/components/ui.tsx; add new primitives there.
- Never hard-code colours; use the tokens in globals.css.
- Money is integer pence, shown via <Amount>.
- After UI changes, screenshot the page and self-review before finishing.
```

### 5. Optional: shadcn/ui MCP
IDEA.md lists shadcn as optional. `npx shadcn@latest mcp init --client claude` lets Claude browse and install components (good for Drawer/Toast/Dialog). Restyle them with the project tokens before use.

### Prompting habits that matter more than tools
- **Give a reference:** a screenshot of Monzo, Revolut or Splitwise pasted into the chat beats any adjective.
- **Ask for 2–3 variants** of a key screen (the Home balance card, the bounty row), pick one, then polish.
- **Name the feeling and the constraint:** "calm, friendly, Monzo-like; one accent colour; must fit at 390px with no horizontal scroll."
- **Polish pass at the end:** empty states, loading skeletons, tap feedback (`active:scale-95`), and transitions on the Sheet. These are what make a demo feel like a real app.
