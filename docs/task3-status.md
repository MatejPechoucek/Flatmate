# Part 3 progress — 2026-10-16

Scope: Part 3, **Chores: fairness and buyouts**, in `TASKS.md`.

The core Chores implementation is present. The complete cross-feature demo still needs Home and Split integration and a check against hosted Supabase.

| Requirement | Current evidence / status |
| --- | --- |
| Create and auto-assign chores | Implemented in `src/features/chores/api.ts`, `ChoresScreen.tsx` and SQL RPCs. One-off creation and future recurring schedules are covered by database and browser tests. |
| Rolling 28-day fairness and assignment | Implemented. Database tests cover the cutoff, future history, credited member, weight snapshots, lowest score, tie-breaking and exclusion of pending work. |
| Complete tasks | Implemented and wired to the screen. Tests cover assignee-only completion, repeated/concurrent completion and buyout point attribution. |
| Offer, cancel and accept buyouts | Implemented. Acceptance writes the expense and share in the same SQL transaction. Tests cover retries, concurrent callers, snapshot pricing, cancellation, ownership, rollback and ledger fields. |
| Home contracts | `getOpenTasks` and `getOpenBounties` are implemented. `src/features/flat/HomeScreen.tsx` still reads demo data; the consuming Home integration is outstanding. |
| Recurring catch-up | Implemented and invoked by the flat provider and Chores screen. Database tests cover missed occurrences, concurrent catch-up, exact due time, inactive schedules and completion leaving the schedule unchanged. |
| Weight objections / voting | Deferred; optional in `TASKS.md` and excluded by the feature README. |

## Integration work remaining

1. Home owner: consume the real task/bounty contracts and replace demo activity and balances.
2. Split owner: read the real expense/share ledger and implement balances. `src/features/split/api.ts` still contains TODO implementations and `SplitScreen.tsx` uses demo expenses/balances. The £5 buyout debt is stored correctly, but cannot yet be demonstrated in the Split UI in this checkout.
3. Preserve the atomic buyout path: `accept_bounty` already inserts the expense and share. Calling client-side `addExpense` afterward would duplicate the write; the older wording in `TASKS.md` and `SPLIT.md` needs reconciliation with the feature handoff.
4. Verify hosted PostgREST and Supabase Realtime with two sessions. Local browser tests use actual PostgreSQL RPCs through a test HTTP adapter; cross-session updates exercise fallback refresh, not hosted Realtime transport.

## Added coverage

Five database tests in `tests/chores.test.mjs` cover concurrent offer creation and repricing, acceptance retries after completion and the Split ledger contract, fairness exclusions, recurrence boundaries, and flat-scoped board/assignment reads.

Three browser tests in `tests/browser/chores.spec.ts` cover failed-save recovery without duplicate creation, assignee/offerer controls with cancellation and re-offering across two sessions, and the demo connection prompt.

No application or shared platform code was changed.

## Verification

- `npm test`: 17 database tests passed against a disposable local PostgreSQL database.
- `npm run test:browser`: all 5 Chromium browser tests passed (50.5 seconds).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed. It reports missing public Supabase environment variables in this checkout, so the build is not evidence of a configured live connection.
- Next.js development mode reports an instant-navigation validation diagnostic for the chores route. This also occurred in the original browser suite; route-level validation remains a platform follow-up.
