# Flatmate

**Flat life, minus the awkward.** Split bills and share chores fairly with your flatmates. The app does the chasing, so nobody has to be the bad guy.

## Why

Shared living rarely falls apart over maths. It falls apart over the conversations nobody wants to have: chasing £4.20, or pointing out who hasn't cleaned the bathroom. Flatmate makes the app the neutral party, so those conversations don't need to happen.

## How it works

- **Split:** add an expense and split it equally, by amount or by percentage. Recurring bills (Wi-Fi, energy) appear on their own. Settle up with a pre-filled PayPal.me link, or by cash or bank transfer.
- **Chores:** every chore has an effort weight from 1 to 5. Each new task goes to whoever has done the fewest points in the last 28 days, so it's fair without anyone keeping score.
- **Buyouts:** too busy this week? Put your chore up for `weight × £1`. The first flatmate to accept does it and gets paid through the shared ledger, and you keep the fairness points you paid for.
- **No sign-up:** join a flat with a link or QR code and your name.

## Run it

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + anon key
npm run dev
```

Run `supabase/schema.sql` once in the Supabase SQL editor. Open `/flat/demo` to browse the app with sample data and no database.

## Stack

Next.js · TypeScript · Tailwind · Supabase (Postgres + Realtime)

## Layout

```
src/app/             routes: landing, /join/[code], /flat/[flatId]/{split,chores,settings}
src/features/flat    create/join, home, flat settings
src/features/split   expenses, balances, recurring bills, settle up
src/features/chores  chores, fairness, auto-assign, buyouts
src/components/ui    shared UI kit (see DESIGN.md)
src/lib              Supabase client, types, flat context, realtime, money/date helpers
supabase/schema.sql  database schema
```
