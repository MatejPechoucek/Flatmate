# Flatmate

**Flat life, minus the awkward.** Split bills and share chores fairly with your flatmates. The app does the chasing, so nobody has to be the bad guy.

**Live:** [flatmate-gules.vercel.app](https://flatmate-gules.vercel.app)

## Why

Shared living rarely falls apart over maths. It falls apart over the conversations nobody wants to have: chasing £4.20, or pointing out who hasn't cleaned the bathroom. Flatmate makes the app the neutral party, so those conversations don't need to happen.

## Features

- **Split:** add an expense and split it equally, by amount or by percentage. Weekly and monthly bills (Wi-Fi, energy) appear on their own. Balances are simplified into the fewest possible payments.
- **Settle up:** pay with a pre-filled PayPal.me link, or by cash or bank transfer, then confirm it in the app.
- **Fair chores:** every chore has an effort weight from 1 to 5. Each new task goes to whoever has the fewest points from the last 28 days, so it's fair without anyone keeping score.
- **Buyouts:** too busy this week? Offer your chore for `weight × rate` (default £1 per point). The flatmate who takes it gets paid through the shared ledger, and you keep the fairness points you paid for.
- **Edit history:** if someone edits or deletes an expense you're part of, you get a notice showing what changed.
- **No sign-up:** join with an invite link, QR code or 6-letter code, plus your name. Your identity is remembered on that device.
- **Live everywhere:** changes from other flatmates appear instantly (Supabase Realtime). Mobile-first, with a sidebar layout on desktop and light and dark themes.

## Run it locally

```bash
npm install
```

Create `.env.local` with your Supabase project's URL and publishable (anon) key:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=<publishable key>
```

Set up the database in the Supabase **SQL Editor**:

| Situation | Run |
|---|---|
| New project | `supabase/schema.sql` (includes everything), then optionally `supabase/seed.sql` for a sample flat |
| Database created from an older `schema.sql` | `supabase/migrations/002_split_audit.sql`, then `003_chores.sql`, in that order |

The migrations are safe to re-run. If you see errors like `column expenses.deleted_at does not exist` or `Could not find the function public.get_chore_board`, the database is behind the code: run the migrations.

```bash
npm run dev   # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test:unit` | Money, share, balance and schedule maths (`node --test`, no setup) |
| `npm run test:db` | Chore SQL functions against a disposable local Postgres (needs Postgres on `/tmp`, or set `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright browser tests (also needs local Postgres) |
| `npm run build` | Production build |

## Deploy

The app is a Vercel project (`flatmate`). Set the two `NEXT_PUBLIC_SUPABASE_*` variables in Vercel, then:

```bash
npx vercel           # preview deployment
npx vercel --prod    # production → flatmate-gules.vercel.app
```

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Realtime, RPC) · lucide-react · Vercel

## Project layout

```
src/app/                 routes: / (landing), /join/[code], /flat/[flatId]/{split,chores,settings}
src/features/flat/       create and join, Home summary, flat settings, activity feed
src/features/split/      expenses, balances, recurring bills, settle up, edit notices
src/features/chores/     chore board, fairness, assignment, buyouts
src/components/ui.tsx    shared UI kit, used by every screen
src/lib/                 Supabase client, types, flat context, realtime, money and date helpers
supabase/                schema.sql, migrations/, seed.sql
tests/                   database and Playwright tests
```

**Chore writes** go through SQL functions (`create_chore`, `complete_chore_task`, `offer_bounty`, `accept_bounty`, …). They lock rows, so assignment and buyouts stay consistent when two flatmates act at once. `accept_bounty` reassigns the task and records the debt in a single transaction, so never call `addExpense` for a buyout as well.

## Team

Each part owns one feature folder and only edits its own files. Functions marked **CONTRACT** in an `api.ts` are used by other parts, so keep their signatures stable.

| Part | Owns |
|---|---|
| 1 · Flat | `src/features/flat`, `src/app`, `src/components/ui.tsx`, `src/lib`, `supabase/schema.sql` |
| 2 · Split | `src/features/split` (expenses, shares, recurring bills, settlements) |
| 3 · Chores | `src/features/chores` (chores, tasks, bounties, fairness) |

## Design rules

Mobile-first, calm and friendly. One accent colour, plenty of whitespace, and money that's always easy to read.

- **Colours only through tokens** in `src/app/globals.css` (light and dark): `background`, `surface`, `surface-2`, `border`, `foreground`, `muted`, `accent`, and `positive`/`negative`/`warning` (each with a `-soft` variant). Never use hex values or Tailwind palette colours.
- **Build screens from `ui.tsx`.** If you need a new pattern, add a component there instead of one-off classes in a screen.
- **Money** is integer pence everywhere: show it with `<Amount>` or `formatPence`, and parse input with `parsePounds`.
- **Forms open in a `<Sheet>`** (a bottom sheet on phones, a dialog on desktop), never a new page. One primary button per view, and one `Fab` per screen.
- **Touch targets** are at least 44px (buttons `h-12`, rows `min-h-16`). Icons come from lucide, at 18–22px.
- **Loading** uses `<Skeleton>` blocks in the shape of the real layout. **Empty lists** use `<EmptyState>` with one friendly sentence.
- **Copy** is short, warm and neutral. The app nudges and never blames: "Due tomorrow", not "You haven't…".

| Component | Use |
|---|---|
| `Button` | `primary` (one per view), `secondary`, `ghost`, `danger`; `size="sm"` inside rows |
| `Fab` | Floating "add" action; above the tab bar on phones, bottom-right of the content on desktop |
| `Input`, `SegmentedControl` | Pass `label` for a stacked label / mode switches (Equal · £ · %) |
| `Sheet` | Every create or edit form; controlled with `open` / `onClose` |
| `Section`, `List`, `ListRow`, `Card` | Screen structure: titled sections of rows (leading · title/subtitle · trailing) |
| `Avatar`, `AvatarStack` | Colour comes from the name, so always pass the real name (`realName(id)`) |
| `Badge`, `Amount`, `WeightDots`, `ProgressBar` | Status pills, money (`signed` colours it), chore effort 1–5, fairness bars |
| `Skeleton`, `EmptyState` | Loading placeholders and empty lists |

People: `memberName(id)` shows "You" for yourself, and `realName(id)` gives the actual name. Dates: `timeAgo()` for history, `dueLabel()` for chores. For live data, call `useRealtime(flat.id, ["table", …], reload)`.
