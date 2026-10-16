# Split: build plan

Owner: Split · Folder: `src/features/split/` · Tables: `expenses`, `expense_shares`, `recurring_expenses`, `settlements` (+ `expense_changes`, below)

## Decisions

| Topic | Decision |
|---|---|
| Participants | Each expense has a toggle per flatmate; **everyone is in by default**. The payer can be excluded (paying on someone's behalf). |
| Split modes | **Equal** (default) · **£ amounts** · **% percentages**. Leftover pence go to the payer, or to the first participant if the payer isn't in. |
| Balances | **Simplified from the start**: the fewest payments that settle the whole flat. |
| Settle up | The **payer marks it paid**: Settle up → PayPal opens → "Did you pay £X to Sam?" → Yes records a settlement. |
| Edit | Only the flatmate who **added** the expense can edit it. Affected flatmates get an in-app notice showing before → after. |
| Delete | The creator can **soft delete** (hidden from balances, kept in the database). Affected flatmates get a notice. |
| Notices | The expense shows an **"Edited"** badge. A dismissible banner at the top of Split reads e.g. "Alex changed Tesco shop £42.60 → £52.60 (your share £10.65 → £13.15)". |
| Recurring | Fixed amount, weekly/monthly, with a **start date (default today)**. The first expense is created on the start date. Each generated expense can be edited like any other. |
| Payments | **PayPal.me links only.** Apple Pay / Google Pay can't send money to a person in the UK, and on the web they only pay merchants. Cash or bank transfer is the fallback. |
| Buyouts | Created by Chores through `addExpense({ bountyId })`. **These can't be edited or deleted**, because the bounty is the source of truth. |

---

## 0 · Schema additions ✅ done

- `schema.sql` now includes `expenses.created_by | edited_at | deleted_at` and the `expense_changes` + `expense_change_dismissals` tables.
- **If the database was set up before this change**, run `supabase/migrations/002_split_audit.sql` once (it's safe to re-run).
- Types are in `src/lib/types.ts`: `Expense` (new fields), `ExpenseSnapshot`, `ExpenseChange`, `ExpenseChangeDismissal`.
- `addExpense` now takes `createdBy`.

---

## 1 · `computeShares` (pure function, no database) · ~10 min

`computeShares(amountPence, splitType, payerId, values) → Record<memberId, pence>`, where `values` holds only the **participants**.

- **equal:** `floor(amount / n)` each; the leftover `amount % n` goes to the payer (or the first participant).
- **amount:** values are pence and must sum to `amountPence` exactly, or it throws.
- **percent:** values are integers 0–100 and must sum to 100. Each share is `floor(amount × pct / 100)`; leftovers as above.
- It throws on: no participants, amount ≤ 0, or a negative value.

**Check by hand:**
| Input | Expected |
|---|---|
| £10.00 equal, payer A + B + C | A 334, B 333, C 333 |
| £10.00 equal, B + C (payer A excluded) | B 500, C 500 |
| £10.00 %, A 50 / B 25 / C 25 | 500 / 250 / 250 |
| £10.01 %, A 33 / B 33 / C 34 | A 331, B 330, C 340 (1p leftover to A) |
| £10.00 £, A 600 / B 300 | throws (sums to 900) |

**Done when** the table above passes. A quick `console.assert` block is fine.

## 2 · Add expense · ~20 min

`addExpense(input)` **(CONTRACT)**: insert into `expenses` (with `created_by`), then insert `expense_shares` rows. Return the expense.

Wire up `AddExpenseSheet`:
- Description, amount (`parsePounds`), **payer picker** (default: me), participant toggles (all on).
- Mode `Equal | £ | %`. For £ and %, show a live **"£X left to assign" / "Y% left"** line, and disable Save until it's 0.
- Equal mode shows each participant's share as you type.
- Once / Weekly / Monthly toggle. Weekly or Monthly shows a start date (default today); see step 6.
- After saving, close the sheet and reset the form.

**Done when** adding an expense on one browser shows it on another without refreshing.

## 3 · Expense list + realtime · ~10 min

- `getExpenses(flatId)`: non-deleted, newest first, with shares.
- Rows show the payer avatar, description, a ↻ icon if recurring, a **Buyout** badge, an **Edited** badge, "Sam paid · 2 days ago", the total and *your share*.
- `useRealtime(flat.id, ["expenses", "expense_shares", "settlements", "expense_changes"], reload)`
- Tapping a row opens the **ExpenseDetailSheet**: who owes what, change history, and Edit/Delete if you created it and it's not a buyout.

## 4 · Simplified balances · ~15 min

1. **Net per member** = Σ paid (non-deleted expenses) − Σ owed shares + Σ settlements sent − Σ settlements received.
2. **Simplify:** split members into creditors (net > 0) and debtors (net < 0). Repeatedly match the largest debtor with the largest creditor, transfer `min(|debt|, credit)`, and continue until everyone is at 0. That gives at most n − 1 payments.
3. `getSettlementPlan(flatId) → { from, to, pence }[]` (the whole flat).
4. `getBalances(flatId, meId)` **(CONTRACT for Home)**: from the plan, transfers to me count as `+pence` and transfers from me as `−pence`.

UI:
- The Balances section lists **my** transfers: "Sam pays you £2.65" or "You pay Priya £3.45 [Settle up]".
- A "See all flat payments" link shows the whole plan.
- An empty plan shows "All settled up 🎉".

**Check:** A pays £30 split A/B/C. Then B pays £30 split A/B/C. Plan: C → A £10, C → B £10. A and B owe each other nothing.

## 5 · Settle up · ~10 min

1. Tap **Settle up** → SettleUpSheet: "Pay Priya £3.45".
2. If Priya has a `pay_handle`: an **"Open PayPal"** button opens `payLink(handle, pence)` in a new tab. Otherwise show "Priya hasn't added a payment link, so pay her by bank transfer or cash."
3. Then: **"I've paid £3.45"** → `recordSettlement(flatId, me, priya, pence)`.
4. Balances recalculate, since settlements are part of the net total, and the feed shows "You paid Priya £3.45".

The amount is editable (default: the full balance) to allow partial payments.

## 6 · Recurring bills · ~15 min

- Saving with Weekly/Monthly inserts into `recurring_expenses`: `split_config = { mode, values }` (the participants plus their £ or % values), `next_due_at = start date`. Then call `catchUpRecurringExpenses` straight away.
- `catchUpRecurringExpenses(flatId)` **(CONTRACT)**: for each active rule with `next_due_at <= now`:
  1. `computeShares` from the config → insert an expense with `recurring_expense_id`, `due_at = next_due_at` and `created_by = payer`. **Ignore duplicate-key errors** (another flatmate's app got there first).
  2. Advance it: weekly +7 days, monthly +1 month (31 Jan → 28/29 Feb). Use `update … where next_due_at = <old value>` so it only advances once.
  3. Loop until `next_due_at > now`, which catches up on missed periods.
- A **Recurring** section lists the rules: "Wi-Fi · £32.00 monthly · next 16 Nov", with a Pause/Resume toggle (`active`) and Delete.
- To change this month's energy amount, edit the generated expense (step 7). The rule keeps the usual amount.

## 7 · Edit, delete and notices · ~20 min

**Edit** (creator only, not buyouts):
1. Open AddExpenseSheet pre-filled.
2. On save, take a `before` snapshot, update the expense and set `edited_at`, delete and re-insert its shares, then insert `expense_changes { kind: 'edit', before, after }`.

**Delete** (creator only, not buyouts):
- Confirm → set `deleted_at` → insert `expense_changes { kind: 'delete', before }`.

**Notices:**
- `getMyNotices(flatId, meId)`: changes where `changed_by ≠ me`, I'm the payer or a participant in `before` or `after`, and there's no dismissal for me.
- Show them as banners at the top of Split:
  - "Alex changed **Tesco shop** £42.60 → £52.60 · your share £10.65 → £13.15"
  - "Alex deleted **Tesco shop** (£42.60) · your share was £10.65"
- Tapping ✕ inserts a dismissal.
- ExpenseDetailSheet shows the full change history, so the change is visible to everyone, not just the people affected.

---

## Order and cuts

| # | Task | Time | Priority |
|---|---|---|---|
| 0 | Schema additions + types | 5 min | Must |
| 1 | `computeShares` | 10 min | Must |
| 2 | Add expense | 20 min | Must (**Chores is waiting for `addExpense`; build it first and push**) |
| 3 | List + realtime | 10 min | Must |
| 4 | Simplified balances | 15 min | Must (Home is waiting for `getBalances`) |
| 5 | Settle up | 10 min | Must (demo step 6) |
| 6 | Recurring | 15 min | Should |
| 7 | Edit/delete + notices | 20 min | Should |

That's about 105 minutes, which is more than the build time you have. **If behind at 1:15, cut in this order:** recurring Pause/Resume → change history in the detail sheet → recurring entirely (pitch it as "coming soon") → the delete notice (keep the edit notice).

## Things to double-check
- Deleted expenses must be excluded **everywhere**: the list, balances and `getBalances`.
- A buyout expense appears in balances like any other, but has no Edit/Delete.
- Every amount displayed goes through `<Amount>` or `formatPence`; never do maths on floats.
- Test with 2 browser windows as 2 flatmates (one normal, one private window, so they have separate identities).
