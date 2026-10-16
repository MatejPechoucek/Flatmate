# Design guide

Mobile-first, calm, friendly. One accent colour, plenty of whitespace, and money that's always easy to read.
Build every screen from `src/components/ui.tsx`. If you need something new, add it there, not inline.

## Colour tokens

Defined in `src/app/globals.css`, with automatic light and dark versions. **Never hard-code hex values or Tailwind palette colours** (`bg-blue-500`); use these classes:

| Token | Use for |
|---|---|
| `background` | Page background |
| `surface` / `surface-2` | Cards and lists / inputs, segmented controls, secondary buttons |
| `border` | Hairlines, card borders |
| `foreground` / `muted` | Primary text / secondary text, labels |
| `accent` (+ `accent-soft`, `accent-fg`) | Brand, primary buttons, active tab, weight dots |
| `positive` (+ `-soft`) | You're owed, chore done |
| `negative` (+ `-soft`) | You owe, overdue |
| `warning` (+ `-soft`) | Bounties / money on offer |

## Screen anatomy

```
Header        flat name + avatar stack (from the layout; don't add your own)
Section       uppercase muted title + optional action
  List        rounded container of ListRows separated by hairlines
  Card        free-form content (charts, QR code)
Fab           one primary "add" action per screen, opens a Sheet
TabBar        Home · Split · Chores · Flat
```

- A screen is a vertical stack of `<Section>`s with `gap-6`.
- Lists of things → `<List>` + `<ListRow leading title subtitle trailing>`. Leading is usually an `<Avatar>` or a round icon; trailing is an amount, badge or small button.
- Create and edit forms always go in a `<Sheet>` (bottom sheet), never a new page.
- Empty lists → `<EmptyState>` with one friendly sentence.

## Components

| Component | Notes |
|---|---|
| `Button` | `primary` (one per view), `secondary`, `ghost`, `danger`; `size="sm"` inside rows |
| `Fab` | Floating add button above the tab bar |
| `Input` | Pass `label` for a stacked label |
| `SegmentedControl` | Mode switches: Equal / £ / %, Recurring / One-off |
| `Sheet` | Bottom sheet; controlled with `open` / `onClose` |
| `Avatar`, `AvatarStack` | Colour is derived from the name; always pass the **real name** (`realName(id)`), not "You" |
| `Badge` | Status pills: `neutral`, `accent`, `positive`, `negative`, `warning` |
| `Amount` | **All money goes through this.** `signed` adds +/− and green/red from the viewer's perspective |
| `WeightDots` | Chore effort, 1–5 |
| `ProgressBar` | Fairness bars |

## Conventions

- **Money:** store and pass integer pence. Format with `formatPence` or `<Amount>`. Parse input with `parsePounds`.
- **Dates:** `timeAgo()` for history, `dueLabel()` for chores.
- **People:** `memberName(id)` shows "You" for yourself; `realName(id)` is for avatars.
- **Copy:** short, warm and neutral. The app nudges, it never blames ("Due tomorrow", not "You haven't done…").
- **Icons:** `lucide-react`, size 18–22.
- **Touch targets:** at least 44px high (buttons are `h-12`, rows `min-h-16`).
- **Live data:** call `useRealtime(flat.id, ["table", ...], reload)` so other flatmates' changes appear instantly.
