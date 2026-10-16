# Part 3: chores and buyouts

This branch builds on main: `useFlat`, `supabase`, `useRealtime`, the shared UI kit and `/flat/[flatId]/chores`. The chore schema it needs is already on main (`supabase/schema.sql`); this branch only adds the feature code. `ChoresScreen` obtains identity from the platform; `ChoresTab` also accepts `flatId`, `memberId` and an optional mutation callback for cache invalidation.

## Database handoff

`supabase/schema.sql` (main) is the source of truth and now contains the full chore schema: the `weight_snapshot` column, the state-machine RPCs and the read-only client access rules. A fresh project only needs to run `schema.sql`.

For a database created before this change, run the migrations in `supabase/migrations/` in order (`002_split_audit.sql`, then `003_chores.sql`). They are idempotent, so running them after `schema.sql` is also safe. `003_chores.sql`:

- adds `chore_tasks.weight_snapshot` (integer 1–5, required), backfilled from the current chore weight for legacy tasks — historical weights before it cannot be reconstructed;
- adds a unique non-null index on `expenses.bounty_id` and allows at most one open/accepted bounty per task;
- installs the SQL RPCs for creation, completion, offering, cancellation, acceptance, catch-up and board reads;
- leaves browser access read-only on chore tables; state changes go through RPCs and private helpers cannot be called;
- publishes chores, chore_tasks and bounties for Realtime, if the publication exists.

`weight_snapshot: number` is part of the shared `ChoreTask` in `src/lib/types.ts` on main; the feature-local `Task` only adds the joined chore `title`.

## API contracts

Existing `getOpenTasks(flatId, assignedTo?)`, `getOpenBounties(flatId)` and `catchUpChores(flatId)` signatures remain stable. The latter reads the member ID using the platform identity helper. SQL `catch_up_chores` takes both `p_flat_id` and `p_member_id` so it can check membership. The platform's existing flat-open call already invokes it.

Every mutation RPC returns `{ flat_id, task_ids, chore_id?, bounty_id?, expense_id? }`. Creation additionally returns `chore`; offering returns `bounty`. `createChore` and `offerBounty` preserve their row return shape and attach the IDs as `.mutation`. Completion, cancellation and acceptance return the mutation IDs directly. Reload tasks, fairness, bounties and balances after a buyout; `onMutation` is available for hosts with caches. The Chores screen refreshes after mutations and on the shared Realtime hook, window focus and a 15-second fallback poll.

**Buyouts deliberately do not call client-side Split `addExpense`.** That instruction in TASKS.md conflicts with the approved atomicity requirement. `accept_bounty` writes the same `expenses` and `expense_shares` tables in the transaction that accepts and reassigns. Payer = actual doer, share = 100% owed by original offerer, `split_type = 'amount'`, description = `Buyout: <title>`. Split must not insert a second expense. Its normal ledger queries and subscriptions receive these rows.

## Behaviour

- Chores weigh 1–5 points; each task snapshots its weight.
- Assignment uses completed credited points in `(now − 28 days, now]`. Ties prefer the least recent physical doer of that chore, with never first, then random.
- Outstanding work does not count. Several tasks can therefore be assigned to one person; this is intentional for the demo.
- A one-off task is created now, even if its optional due date is in the future. Recurring occurrences are created only when due, at fixed UTC intervals of `interval_days × 24 hours`. Catch-up includes every missed due date; completion never advances it.
- Only the current assignee completes. Repeated completion is idempotent. Open unaccepted offers are cancelled on completion.
- Offer price snapshots task weight × flat rate (default 100 pence per point). Acceptance creates debt; completion credits the original offerer. Accepted buyouts cannot be cancelled or offered again.
- No credits, rewards, claiming, reservations, away mode, voting, objections or bounty raises. No real payments.
- Name/localStorage identity is the agreed hackathon trust model, not authentication. A caller with another member's UUID can impersonate them. Read access remains demo-permissive.
- `/flat/demo/chores` shows an explicit connection prompt; live mutations require a real joined flat.

## Verification

```sh
npm install
npm test                 # real PostgreSQL, creates and drops a disposable DB
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
```

Tests default to `postgresql:///postgres?host=/tmp`. Set `TEST_DATABASE_URL` to a local test server's maintenance database if needed. The role must be able to create a database and the Supabase `anon`/`authenticated` roles if absent. Only newly created test roles are removed. Never point tests at a production server. Browser tests use ports 3100 and 54329 and create a separate disposable database.

Browser tests use the real Supabase JS client against a test-only HTTP adapter running the actual SQL RPCs, plus two isolated browser contexts. They test persistence and fallback refresh; **they do not certify hosted PostgREST or Supabase Realtime delivery**. On the connected project, verify those transports with two devices before the demo.

## Corrected demo

1. Join the same flat in two browser sessions with different names.
2. Complete an assigned task. Show fairness changing immediately and appearing on the second session.
3. Create another one-off task. Show assignment to a member with the lowest completed score.
4. Offer a 5-point bathroom task at £1/point; another member accepts. Show one £5 debt from offerer to doer in Split.
5. Complete as the accepter. The offerer gets 5 points; the accepter is recorded as physical doer.
6. Add a recurring chore due in the future. It stays scheduled until due; do not generate an early occurrence for the demo.
