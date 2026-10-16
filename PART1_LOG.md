# Part 1 · Flat — work log

Running log of everything done for **Part 1** in `TASKS.md` (onboarding, home, platform), with the reasoning behind each change.
Status: `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run build` ✅ (built without env vars; untested against a live Supabase until step 1 is done).

---

## Task checklist

| # | Task | Status |
|---|---|---|
| 1 | Supabase project, run `schema.sql`, share `.env.local`, deploy to Vercel | 🟡 Supabase ✅ (schema + seed run, `.env.local` set, read/write verified 16 Oct) · share env with team ⏳ · Vercel ✅ **https://flatmate-gules.vercel.app** |
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
   - Notes from doing it: Supabase warns *"creates tables without enabling RLS"* on `schema.sql`. That's a false alarm, because the loop at the end enables RLS. Click **Run without RLS**. Use the URL **without** `/rest/v1/`. Keys are at Project Settings → API Keys (Publishable `sb_publishable_…`, or Legacy → `anon`). Watch for a stray space after `=` in `.env.local`.
4. **Vercel (what we actually did):** the GitHub repo belongs to a teammate, so Vercel's Git import wasn't available to us. We deployed with the CLI instead:
   `npx vercel login` → `npx vercel link --yes --project flatmate` → added both env vars for production, preview and development (the key needs `--type config`, because Vercel asks before exposing anything named `*KEY*`; the publishable key is meant to be public) → `npx vercel deploy --prod --yes`.
   **To redeploy after changes:** `npx vercel deploy --prod --yes`. It deploys your *local* files, whatever branch you're on. For automatic deploys on push, the repo owner can connect it in the Vercel dashboard (Project → Settings → Git).
   *Original plan, for reference:* import the GitHub repo at vercel.com/new, add the same two env vars, deploy. The QR code uses `window.location.origin`, so it automatically points to the Vercel URL once you open the app there. **Show the QR from the deployed site, not localhost**, otherwise judges' phones can't open it.

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

### ✅ Installed (16 Oct)
- `frontend-design@claude-plugins-official`, installed with `claude plugin install …` (user scope: on your machine only, so each teammate runs the same command).
- **Project skill `.claude/skills/flatmate-ui/SKILL.md`**: our repo-specific rules (tokens only, build from `ui.tsx`, money via `<Amount>`, sheets for forms) plus a "where better comes from" checklist and a screenshot-review workflow. It's committed to the repo, so teammates get it automatically. It deliberately **overrides** `frontend-design` wherever they disagree, so the three Parts stay visually consistent.
- **Custom skills in general:** a skill is just a folder with a `SKILL.md`. It goes in `.claude/skills/<name>/` (in the project, shared via git) or `~/.claude/skills/<name>/` (personal). The `description` in its front matter decides when Claude uses it automatically; you can also run it as `/<name>`.

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

## UI restyle: cleaner look (kit-level, so every screen inherits it)
**What changed**
- `ui.tsx`: Lists, Cards, EmptyState and Inputs dropped their borders and dashed outlines. They're now borderless `surface` blocks with `rounded-3xl`, and inputs get a soft focus ring. Small buttons are pill-shaped (`h-9`), disabled buttons fade to 40%, the FAB lost its purple glow, the sheet close button is a 36px round target, and badges and row spacing got a bit more breathing room.
- New `Skeleton` component (added to the DESIGN.md table). Home uses `HomeSkeleton` in place of the "Loading…" text.
- `globals.css`: a slightly warmer, lower-contrast light background and border, plus `animate-sheet-up`, `animate-fade-in` and `animate-rise-in` utilities (200–240ms, turned off under `prefers-reduced-motion`).
- Sheet slides up and its backdrop fades in. Page content fades and rises in on tab change.
- Flat layout: bigger flat name, safe-area padding, and a tab bar without the top border whose active tab sits on an `accent-soft` pill.
- Home hero: was a solid accent slab with a coloured glow, now a surface card with a 5xl `<Amount>` coloured positive or negative and a "Balances →" link.

**Why**
- Every list had a border on top of a fill, so the screens felt boxy. The skill says "whitespace over borders".
- The hero was the loudest element but didn't say whether you owe or are owed. Colouring the number by meaning makes it the clear hero number.
- Split and Chores screens belong to Parts 2 and 3, so I changed only the shared kit, tokens and layout (Part 1). Their screens pick up the new look with no edits.

## Desktop layout (lg ≥ 1024px), phones unchanged
**What changed**
- Root layout: the phone-width column (`max-w-md`) now only applies below `lg`.
- Flat layout: below `lg` it's the header plus the bottom tab bar, as before. From `lg` up the tab bar is hidden and a sticky left `Sidebar` (240px: logo + the same 4 tabs) takes over. Content sits in a centred `max-w-3xl` column.
- `Fab`: on desktop it lines up with the content column's bottom-right corner, since there's no tab bar to sit above.
- `Sheet`: from `sm` up it's a centred dialog (`rounded-3xl`, `animate-pop-in`, no grab handle). Phones still get the bottom sheet.
- Home: on desktop, chores and bounties go in the left column and Activity in the right. The skeleton matches.
- Landing: on desktop, the pitch and feature cards go on the left and the form on the right. Join is centred at `max-w-md`.

**Why**
- On a laptop the app was a 448px strip with a phone tab bar floating at the bottom. A sidebar is the standard desktop pattern, and a 768px column keeps rows readable without stretching.
- All of it is done in the layout and kit (Part 1), so Split and Chores get the desktop layout without any changes to their screens.

## Settle up works on the demo flat
- I wrote an in-memory version of demo settle-up. Meanwhile Split (Part 2) merged their own into `main` (`demoStore.ts`), so in the merge I kept theirs.
- **Why theirs:** it never opens PayPal for the demo flat's made-up handles, which could belong to real people, so no real money gets sent to strangers. It also pushes updates to subscribers, so every screen refreshes immediately. Mine did neither.

## Fix everything pass (demo chores, Home, overlay bug, hydration, live DB)
**What changed**
- **Live Supabase was behind the code.** `002_split_audit.sql` and `003_chores.sql` had never been run, which caused "column expenses.deleted_at does not exist", missing `catch_up_chores` / `get_chore_board`, and failing chore actions. Alin ran both in the SQL Editor (002 first, because 003's `accept_bounty` writes `expenses.created_by`). I confirmed it end to end on a throwaway real flat: create flat, create and complete a chore, add an expense, Home activity. Test flats deleted afterwards.
- **Chores work on the demo flat:** new `src/features/chores/demoStore.ts` mirrors the 003 RPCs in memory (28-day fairness, lowest-score assignment, complete, offer, cancel, accept, create one-off/recurring). Accepting a bounty adds the buyout expense to Split's demo store, as `accept_bounty` does. `ChoresScreen` switches between `demoOps` and `realOps`; there's no more "needs a connected flat" message.
- **Home on the demo flat now reads the live demo stores** (Split + Chores), so its balance matches Split ("You owe £9.50") and updates after settling, buyouts and chores. Real flats fetch the chore board once instead of twice. Removed the stale `demoBalances`, `demoFairness` and `demoActivity` from `mock.ts`, and the demo bounty is now £2 (weight 2 × £1 rate) instead of £3.
- **Bug I'd introduced:** the page-enter `rise-in` animation left a `transform` on `<main>`. That made `main` the containing block for `position: fixed`, so on phones the tab bar covered open sheets and the Fab was mispositioned. Replaced it with an opacity-only fade.
- **Hydration safety:** demo data is now built only in the browser. The Split hooks get a `null`/empty server snapshot, and Home computes in an effect. On Vercel a warm server can hold `mock.ts` dates from hours earlier, which mismatches "Due tomorrow"/"Today" labels on hydration.

**Verified:** lint, tsc, 39/39 unit tests, build. In Chrome against a production build: 12/12 demo checks (balance parity, mark done, offer, cancel, accept, add chore, buyout reaches Split, settle up, Home updates) and 6/6 real-flat checks. Every route at 390 and 1440px, light and dark, has no horizontal overflow and no console errors.
