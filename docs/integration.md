# Cross-feature integration and merge notes

Status as of 2026-10-16: Part 3 (**chores**) and Part 2 (**split**, tasks 1–7) are
merged into `main`. Part 1 (`feat/Alin`, flat/platform screens) is not merged yet.
This note records the shared surface so future commits keep colliding as little as
possible.

## Verified merge status

| Merge into `main` | Result |
| --- | --- |
| `feat/chores` (Part 3) | merged, `main` = the chores tip |
| `feat/Alin` (Part 1) | clean — only `package-lock.json` auto-merged |
| `feat/split` (Part 2) | merged — one conflict in `package.json` (both added `test`), resolved as `test:unit` + `test:db` |

Combined tree (chores + split) verified after the split merge:

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run build` — pass
- `npm run test:unit` — 36/36 (split: shares, balances, schedule, change notices; no setup)
- `npm run test:db` — 17/17 (needs PostgreSQL; set `TEST_DATABASE_URL`, e.g. `postgresql://postgres@localhost:5432/postgres`)
- `npm test` — runs both
- `npm run test:browser` — not re-run after the split merge

To re-check without touching `main`:

```
git merge-tree --write-tree --name-only main origin/feat/Alin
git merge-tree --write-tree --name-only main origin/feat/split
```

## Shared files and where to add

Add to your feature's own section; avoid editing lines another feature owns.

| File | How it is organised | Rule |
| --- | --- | --- |
| `supabase/schema.sql` | per-feature table blocks, then functions, then a shared index block, then the access/Realtime loops | put new tables/functions in your feature section; when extending the `flat_id` index block or the access loops, **append** a line instead of editing existing ones |
| `src/lib/types.ts` | sectioned (`// ─── Split ───`, `// ─── Chores ───`) | add row types under your own section |
| `src/lib/mock.ts` | demo fixtures per feature | add fixtures next to your feature's block |
| `package.json` / `package-lock.json` | shared, generated | add dependencies in their own commit; expect to regenerate the lockfile (`npm install`) when merging — this is the usual conflict source |
| `supabase/migrations/` | numbered, idempotent | next free number is **`004_*`** (`002_split_audit`, `003_chores` taken) |
| `src/features/flat/*` | Part 1 | owned by the flat/platform owner |
| `src/features/chores/*` | Part 3 | owned by chores |
| `src/features/split/*` | Part 2 | owned by split |

## Cross-feature contracts (keep signatures stable)

`src/features/chores/api.ts`:

- `getOpenTasks(flatId, assignedTo?)` → open `ChoreTask & { chore }[]` — used by Home.
- `getOpenBounties(flatId)` → open `Bounty & { task; chore }[]` — used by Home.
- `catchUpChores(flatId)` → idempotent; called by `FlatProvider` on open.

`src/features/split/api.ts`:

- `getBalances(flatId, meId)` → net balance per member — used by Home.
- `catchUpRecurringExpenses(flatId)` → idempotent, called by `FlatProvider`.
- `addExpense(input)` — general expense inserts.

`src/features/flat/*`: `HomeScreen.tsx` already consumes `getOpenTasks`,
`getOpenBounties` and `getBalances`, with a demo fallback when no flat is connected.

## Buyouts are atomic in SQL — do not double-write

Accepting a bounty runs `accept_bounty`, which inserts the `expenses` +
`expense_shares` rows (with `bounty_id`) in **one** transaction. Split renders those
rows like any other expense; it must **not** call `addExpense` again for a buyout,
or the debt is recorded twice. The older client-side sequencing in `TASKS.md` /
`SPLIT.md` is superseded by this handoff.
