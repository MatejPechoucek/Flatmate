# Chores implementation ledger

Source: user-supplied chores and buyouts plan, 2026-10-16; IDEA.md, with plan exclusions authoritative.

- Ruling: platform scaffold/schema absent locally and remotely; provide a minimal replaceable Next.js host and IDEA-compatible base migration. Integration may require reconciling the platform contributor's eventual files.
- Ruling: GPT-5-terra unavailable; coordinator implements UI and database as permitted by the plan.
- Pre-flight: shared schema -> SQL RPC -> src/lib/types.ts -> injected ChoresTab client/identity. Ledger insertion stays in accept_bounty transaction. Realtime belongs to host.
- Worktree: ../ClaudeHackathon-chores, existing feat/chores branch advanced to main baseline.

## Tasks
1. Schema and RPC contracts; database tests first.
2. Creation, weighted assignment, completion, fairness.
3. Atomic bounty lifecycle and ledger writes.
4. Recurring catch-up and uniqueness.
5. UI, host integration, verification and fresh correctness review.

## Platform integration update
- User directed rebase onto main; rebased feat/chores onto 884f079 (Initial Framework).
- Earlier absent-scaffold ruling superseded: removed the temporary host/bootstrap, use platform routes, UI kit, identity and Realtime. Shared files and schema.sql remain platform-owned.
- Ruling: keep acceptance and ledger insertion in one SQL transaction; TASKS.md's client-side addExpense sequence cannot meet the approved rollback/concurrency requirements. Split sees the same expenses/expense_shares rows and bounty_id. Cost: Split must not insert a second buyout expense.
- Shared ChoreTask extension is now adopted: `weight_snapshot` lives in `src/lib/types.ts` on main, so the feature `Task` only adds the joined chore `title`.
- Schema landed on main: `supabase/schema.sql` now holds the chore RPCs, `weight_snapshot`, unique indexes and read-only client access; `supabase/migrations/003_chores.sql` is the idempotent upgrade for older databases (mirrors `002_split_audit.sql`).
- catchUpChores(flatId) keeps the platform CONTRACT and resolves the member from existing localStorage identity before calling catch_up_chores(flatId, memberId).
- Database core: 12 tests passed against the platform schema (`schema.sql` + all migrations); rerun after rebasing onto the split schema change.
