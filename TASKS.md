# Work split

Three parts, three owners. Each part owns one folder in `src/features/` and only edits its own files.
Every screen already renders with demo data; your job is to replace `demo*` imports with real calls to your `api.ts`.

Functions marked **CONTRACT** in an `api.ts` are used by another part. Keep their signatures stable; if you must change one, tell the team first.

---

## Part 1 · Flat: onboarding, home, platform
**Folder:** `src/features/flat/` · **Tables:** `flats`, `members`
**Also owns:** `src/lib/*`, `src/components/ui.tsx`, `src/app/` routes, `supabase/schema.sql`

1. **Setup (first 15 min, unblocks everyone):** create the Supabase project, run `schema.sql`, share `.env.local`, deploy to Vercel.
2. `createFlat`, `findFlatByCode`, `joinFlat` → wire up `LandingScreen` and `JoinScreen`.
3. `SettingsScreen`: real invite link + QR (already working), buyout rate editor.
4. `HomeScreen`: replace demo data with `getBalances` (Split) and `getOpenTasks` / `getOpenBounties` (Chores). Until those land, keep the demo data.
5. Activity feed (simplest version: the latest expenses + completed tasks, merged by date).
6. **Seed script** for the demo flat (4 flatmates, a few weeks of history) + demo rehearsal.

## Part 2 · Split: money
**Folder:** `src/features/split/` · **Tables:** `expenses`, `expense_shares`, `recurring_expenses`, `settlements`

1. `computeShares`: equal / £ / %, leftovers to the payer. Validate that totals match.
2. `addExpense` → wire up `AddExpenseSheet` (**CONTRACT**: Chores calls it for buyouts).
3. Expense list from Supabase, with `useRealtime(flat.id, ["expenses", "expense_shares"], reload)`.
4. `getBalances` → Balances section (**CONTRACT**: Home uses it).
5. **Settle up:** `payLink()` opens Monzo/PayPal, then `recordSettlement`.
6. Recurring expenses: save from the sheet's Weekly/Monthly toggle + `catchUpRecurringExpenses`.

## Part 3 · Chores: fairness and buyouts
**Folder:** `src/features/chores/` · **Tables:** `chores`, `chore_tasks`, `weight_objections`, `weight_votes`, `bounties`

1. `createChore` → wire up `AddChoreSheet` (creates the first task, auto-assigned).
2. `getFairness` + `pickAssignee`: lowest 28-day points wins.
3. `completeTask` → the check button (credits points; recurring chores get their next task from `catchUpChores`).
4. **Buyouts** (the demo moment, prioritise it): `offerBounty` → the "£N" button; `acceptBounty` → "Take it". Accepting calls Split's `addExpense`.
5. `getOpenTasks` / `getOpenBounties` (**CONTRACT**: Home uses them).
6. `catchUpChores` for recurring chores; weight objections if time allows.

---

## Rules
- **Shared files** (`src/lib/*`, `src/components/ui.tsx`, `schema.sql`) belong to Part 1. Ask before changing them.
- Follow `DESIGN.md`: use the UI kit and tokens, no hard-coded colours.
- Money is integer pence everywhere.
- Commit small, pull often. Never commit `.env.local`.
