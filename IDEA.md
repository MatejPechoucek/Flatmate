# Flatmate App (working title)

> **The app is the bad guy, so nobody has to be.**
> One app for uni flatmates to split money and share chores fairly, without the awkward conversations.

---

## 1. The problem

Living with flatmates at uni is mostly great until it's about **money** or **chores**:

- Nobody wants to be the one chasing £4.20 for the Tesco shop.
- Nobody wants to say "you haven't cleaned the bathroom in three weeks."
- Existing tools are split: Splitwise/Tricount for money, OurHome for chores. Flatmates won't install two apps, and the two never talk to each other.

The real pain is **social friction**, not maths. Our app takes the confrontation out by making the app the neutral party that tracks, assigns and reminds.

## 2. Target users

UK university students in shared flats and halls (3–6 people). They're low on money, high on friction, and already used to Monzo-style splitting.

## 3. What makes us different

**Chore buyouts.** Money and chores live in the same app, so you can pay a flatmate to take your chore:

> "I've got exams this week. £3 to whoever takes my bathroom shift."

Sam accepts, the chore moves to Sam, and £3 lands in the shared ledger automatically. Splitwise can't do this, and neither can a separate chore app.

---

## 4. Features and rules

### 4.1 Flat setup and identity
- Create a flat → get an **invite link** (`/join/<invite_code>`) and a **QR code**.
- Join = open the link → type your name (plus an optional Monzo.me / PayPal.me username) → done.
- No passwords. The member ID is remembered on the device (localStorage).

### 4.2 Money splits
- **Add expense:** description, amount, payer, who it's split between.
- **Split modes** (chosen per expense):
  - **Equal** (default)
  - **Exact amounts** (£): must add up to the total
  - **Percentages** (%): must add up to 100
- All money is stored in **integer pence**. Rounding leftovers go to the payer's share.
- **Recurring expenses** (Wi-Fi, energy, Netflix): payer, amount, split, interval (weekly/monthly), start date. Occurrences are created automatically (see 4.5).
- **Balances:** net position per flatmate, plus a simplified "who pays whom" list (fewest payments).
- **Settle up:** opens `monzo.me/<user>/<amount>` (or PayPal.me) with the amount filled in, then records a settlement. **We track money; we don't move it.**

### 4.3 Chores
- **Two kinds:**
  - **Recurring:** has an interval (e.g. bins every 7 days) and a next due date.
  - **One-off:** e.g. "buy toilet roll", with an optional due date.
- **Weights:** every chore has a weight of **1–5 points** (bins = 1, bathroom deep clean = 5).
- **Weight approval uses lazy consensus:**
  - The creator proposes a weight, and it's **active immediately**.
  - Any flatmate can **object within 24h** and suggest a different weight. That opens a quick vote.
  - The weight with the most votes wins. A tie keeps the original.
- **Fairness score** = the sum of weights of completed chores **credited to you in the last 28 days** (a rolling window, with no hard reset).
- **Auto-assign:** each new task goes to the flatmate with the **lowest fairness score**.
  - Tie-break 1: whoever did this chore least recently.
  - Tie-break 2: random.
- **Mark as done:** honour system. The completion shows in the flat activity feed, which acts as gentle social proof.
- Missed chores show as **overdue**. There's no penalty.

### 4.4 Chore buyouts
- On any task assigned to you → **"Offer bounty"**.
- **Price is fixed:** `weight × flat rate`. The rate is set per flat, default **£1 per point**. There's no negotiation, because haggling brings back the awkwardness.
- The offer goes to **all flatmates; the first to accept takes it**.
- If nobody takes it, the offerer can **raise the bounty**, but never lower it below the base price.
- **On accept:**
  - The task is reassigned to the accepter (the **doer**).
  - **The payer keeps the fairness points** when it's completed. They paid for that contribution, so the auto-assigner doesn't punish them.
  - The **doer gets the money.** An expense is added automatically to the ledger: paid by the doer, 100% owed by the payer ("Buyout: Bathroom"). This reuses the existing balances, so no separate payment system is needed.
- The offerer can cancel an open bounty before anyone accepts.

### 4.5 Recurring things without a scheduler
Recurring chores and recurring expenses run on a **fixed schedule** but need **no cron job**:
- When anyone opens the flat, a `catch_up(flat_id)` call creates every task or expense whose `next_due_at <= now`, then moves `next_due_at` forward.
- A unique constraint on `(source_id, due_at)` prevents duplicates if two flatmates open the app at the same time.
- Stretch goal: switch to Supabase `pg_cron` for real background generation.

### 4.6 Live updates
Supabase Realtime subscriptions keep every phone in sync instantly. This is key to the demo: mark a chore done on one phone and it updates on the others.

---

## 5. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind** | Join-by-link just works, judges join from their own phones, no Xcode merge conflicts |
| UI | Mobile-first; optional shadcn/ui | It should feel like an app on a phone |
| Backend | **Supabase** (Postgres + Realtime) | Relational ledger, live sync, no server to write |
| Hosting | **Vercel** | Deploy in one click; a public URL for the QR code |
| Payments | Monzo.me / PayPal.me deep links | No regulation, no integration time |
| Auth | Name only + localStorage | Fastest; fine for a hackathon |

**Security note:** Row Level Security is permissive for the hackathon. Anyone with the invite code can read and write the flat. This is acceptable for a demo and must be fixed before real use.

---

## 6. Data model (Supabase)

All money is in integer **pence**. All IDs are `uuid`.

```
flats
  id, name, invite_code (unique), buyout_rate_pence (default 100), created_at

members
  id, flat_id → flats, name, pay_handle (nullable, e.g. monzo username), created_at

expenses
  id, flat_id, payer_id → members, description, amount_pence,
  split_type ('equal' | 'amount' | 'percent'),
  recurring_expense_id (nullable), bounty_id (nullable),
  due_at (nullable, for recurring occurrences), created_at
  UNIQUE (recurring_expense_id, due_at)

expense_shares
  expense_id → expenses, member_id → members, amount_pence
  (always stored as final pence, whatever the split mode)

recurring_expenses
  id, flat_id, payer_id, description, amount_pence, split_type,
  split_config jsonb  -- { member_id: pence | percent }
  interval ('weekly' | 'monthly'), next_due_at, active

settlements
  id, flat_id, from_member, to_member, amount_pence, created_at

chores
  id, flat_id, title, weight (1–5), created_by,
  kind ('recurring' | 'one_off'), interval_days (nullable),
  next_due_at (nullable), weight_proposed_at, active

weight_objections
  id, chore_id, member_id, proposed_weight, created_at

weight_votes
  objection_id, member_id, weight

chore_tasks
  id, chore_id, flat_id, assigned_to → members, due_at,
  status ('open' | 'done'),
  completed_by (nullable), completed_at (nullable),
  points_credited_to (nullable)  -- payer in a buyout, otherwise the doer
  UNIQUE (chore_id, due_at)

bounties
  id, task_id → chore_tasks, offered_by → members, amount_pence,
  status ('open' | 'accepted' | 'cancelled'), accepted_by (nullable), created_at
```

**Derived values (computed in queries or the client):**
- **Balance(member)** = paid (expenses) − owed (shares) + settlements sent − settlements received.
- **Fairness(member)** = Σ weight of `chore_tasks` where `points_credited_to = member` and `completed_at > now() − 28 days`.

---

## 7. Screens

1. **Landing:** "Create a flat" / "Join with code".
2. **Join** (`/join/[code]`): name + optional Monzo handle.
3. **Home / Flat dashboard:** your balance, your next chores, open bounties, activity feed.
4. **Money tab:** expense list, "Add expense" sheet (equal / £ / % toggle), recurring expenses, balances + **Settle up**.
5. **Chores tab:** my tasks, all tasks, fairness bar per flatmate, "Add chore" (weight 1–5), weight objections.
6. **Bounty board:** open bounties with price and an **Accept** button.
7. **Flat settings:** invite link + QR code, buyout rate, members.

---

## 8. Scope for a 2-hour build

| Priority | Feature |
|---|---|
| **Must have** | Create/join flat via link + QR · add expense (equal/£/%) · balances + Monzo settle-up link · chores with weights · auto-assign on lowest fairness · mark done · buyout (offer → accept → ledger entry) · realtime sync |
| **Should have** | Recurring expenses + recurring chores via `catch_up` · weight objection + vote · raise a bounty |
| **Stretch** | Debt simplification · activity feed polish · PWA "Add to Home Screen" · `pg_cron` |
| **Cut** | Notifications · photo proof · real accounts · real payments · AI features |

---

## 9. Team plan (3 people, 2 hours)

| Time | Person A: Platform & Money | Person B: Expenses | Person C: Chores & Buyouts |
|---|---|---|---|
| 0:00–0:15 | Create the Supabase project, run the schema SQL, scaffold Next.js, deploy to Vercel, share env vars | Sketch the Money screens | Sketch the Chores screens |
| 0:15–1:15 | Create/join flat, identity, layout + nav, invite link + QR, Realtime hooks | Add expense (3 split modes), expense list, recurring expenses + `catch_up` | Chores CRUD, weights, fairness score, auto-assign, recurring chores + `catch_up` |
| 1:15–1:35 | Balances + Settle up | Weight objections (if time) | Bounty offer/accept → ledger entry |
| 1:35–1:50 | **Integrate everything, seed the demo flat** | | |
| 1:50–2:00 | **Rehearse the demo twice** | | |

**Rules:** one shared `types.ts` for the schema, one person owns each folder, merge small and often.

---

## 10. Demo script (3 minutes)

1. **Hook (20s):** "Who here has had a passive-aggressive note on the fridge?" The app is the bad guy so nobody has to be.
2. **Join (30s):** show the QR code → a judge scans it and joins our flat live on their phone.
3. **Split (40s):** add "Tesco shop £42.60", switch to a custom % split, and show balances update on every phone.
4. **Chores (40s):** mark bins done → the next bins task auto-assigns to whoever has the fewest points, and the fairness bars move.
5. **Buyout (40s):** "I've got exams" → offer the bathroom (5 pts = £5) → the judge accepts on their phone → the chore moves, £5 appears in the ledger, and I keep my fairness points.
6. **Settle up (10s):** tap Settle up → Monzo opens with the amount filled in.
7. **Close (20s):** roadmap: Open Banking one-tap payments, notifications, an away/exam mode.

---

## 11. Roadmap (after the hackathon)
- **Open Banking payments** (TrueLayer/Yapily) for one-tap settle-up from any bank.
- Push notifications and gentle automated nudges.
- **Away / exam mode:** pause chore assignment while you're away.
- Photo proof or flatmate confirmation for chores.
- Real accounts + proper Row Level Security.
- Move-in / move-out flow (deposits, final settle-up).

## 12. Known risks and open questions
- **Network effect:** the app only works if every flatmate joins. The web link with no install keeps that barrier low.
- **Honour system:** "done" isn't verified. We're betting on social visibility over policing.
- **Fairness gaming:** someone could pick only light chores. Auto-assign and weights limit this, but don't stop it completely.
- **Name:** the product still needs a name.
