---
name: flatmate-ui
description: Design and polish screens in the Flatmate app (Next.js + Tailwind v4, mobile-first). Use whenever building, restyling, or reviewing any UI in src/features/*, src/components/ui.tsx, or src/app/ — "make it look better", "polish", "redesign", new screen, new component, empty/loading states.
---

# Flatmate UI

The repo's design rules, layered on top of the general `frontend-design` skill. When the two disagree, **this file wins**: three people build screens in parallel, and they must look like one app.

## Read first
- `DESIGN.md` (tokens, screen anatomy, component table, copy tone)
- `src/components/ui.tsx` (the kit; every screen is built from it)
- `src/app/globals.css` (colour tokens, light and dark)

## Hard rules
1. **Colours only via tokens:** `bg-background`, `bg-surface`, `bg-surface-2`, `border-border`, `text-foreground`, `text-muted`, `accent` / `accent-soft` / `accent-fg`, `positive*`, `negative*`, `warning*`. Never use hex values or Tailwind palette colours (`bg-blue-500`). For a new colour, add a token to `globals.css` in **both** the light and dark blocks, plus the `@theme inline` mapping.
2. **New visual pattern → new component in `ui.tsx`**, not one-off classes in a screen. Keep its API small and add a line to the DESIGN.md component table.
3. **Money only through `<Amount>` / `formatPence`.** Integer pence everywhere.
4. **Forms go in a `<Sheet>`**, never a new page. One primary `Button` per view. One `Fab` per screen.
5. **Touch targets ≥ 44px**: buttons `h-12`, rows `min-h-16`. Icons from `lucide-react`, size 18–22.
6. **Copy is short, warm and neutral.** The app nudges, it never blames ("Due tomorrow", not "You haven't…").
7. **Only edit files your Part owns** (see TASKS.md). `ui.tsx`, `globals.css` and `src/lib/*` belong to Part 1, so ask before changing them if you're on Part 2 or 3.

## Where "better" comes from (in this order)
1. **Hierarchy:** one hero number per screen (the balance, your next chore). Big, bold, `tabular-nums`. Everything else steps down.
2. **Rhythm:** sections `gap-6`, consistent `px-4`/`px-5`, no cramped rows. Whitespace over borders.
3. **States:** every list has an `EmptyState` with one friendly line; loading uses skeletons (pulsing `bg-surface-2` blocks of the real layout's shape), not "Loading…" text.
4. **Feedback:** `active:scale-[0.98]` on tappables, optimistic updates, a brief success state ("Copied ✓", the check animating on chore done).
5. **Motion:** subtle and fast (150–250ms). Sheets slide up, list items fade or slide in. Respect `prefers-reduced-motion`.
6. **Personality:** Avatars (colour from the name), warm copy, the warning colour for money on offer. Delight lives in the details; stay away from gradients and glassmorphism.

## Workflow
1. `npm run dev`, open the screen at **390×844** (DevTools device mode, or Playwright / claude-in-chrome if available).
2. Screenshot **light and dark** before changing anything. Name 3 concrete problems.
3. Fix them using the kit and tokens. Re-screenshot and compare.
4. `npm run lint && npm run build` before finishing.
5. Check the demo route `/flat/demo` still renders (it uses `src/lib/mock.ts`).
