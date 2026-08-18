# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Workshop demo: a tennis court booking flow, Thai UI. Next.js 16 (App Router) + TypeScript +
Tailwind v4, with bookings persisted in Supabase. The whole UI is one client component in
[app/page.tsx](app/page.tsx).

Courts, prices, and opening hours are still constants in `app/page.tsx`. Only **bookings** live
in the database. There is no auth, no admin, no cancellation — see
[.claude/specs/phase-2-supabase-persistence.md](.claude/specs/phase-2-supabase-persistence.md)
for what is deliberately out of scope, and [CONTEXT.md](CONTEXT.md) for the domain vocabulary
(Slot vs Booking vs Occupancy).

[prototype/index.html](prototype/index.html) is the original single-file vanilla-DOM version the app was
ported from. It still runs standalone (`open prototype/index.html`) and is the reference for markup,
Thai copy, and class strings — but it is **history, not the app**. Do not add features there.

Testing level: minimal

## Commands

Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(the publishable key, `sb_publishable_…` — never the secret key; nothing here uses it).
Without them the app builds fine and fails at first use with `missing_supabase_env`.

```sh
npm run dev                              # dev server (Turbopack)
npm run build                            # production build — catches TS errors dev lets through
open "http://localhost:3000/?selftest=1" # console.assert self-check (see the selftest useEffect in app/page.tsx)
```

`npm run lint` currently warns/fails on Node 20.18 — `eslint-visitor-keys@5` wants `^20.19 || ^22.13 || >=24`.
Next itself only needs `>=20.9`, so `dev` and `build` are unaffected. Upgrade Node or leave lint alone.

There is no test runner. The `?selftest=1` assertions are the only automated check; add asserts there
rather than introducing a framework.

## Coding Style

- **One file for the UI.** All of it lives in `app/page.tsx`. Do not split into components, hooks, or a
  `lib/` module until the file actually outgrows itself — that split is a separate, planned decision.
- **Immutable state.** `setState((s) => ({ ...s, ... }))` only. No `state.x = …`, no `arr.push()`.
- **Pure helpers are `const` arrows** (`formatRanges`, `totalPrice`, `hhmm`, `baht`); flow functions are
  `function` declarations (`goNext`, `confirmBooking`, `handleDialogClose`). Keep the split.
- **Format:** 2 spaces, single quotes, no line-ending semicolons, trailing commas in multi-line literals.
- **Language:** identifiers and this file in English; UI copy and code comments in Thai.
- **Colors go through the `@theme` tokens** in [app/globals.css](app/globals.css) (`bg-ball`, `text-court`,
  `border-line`, …). No raw hex in markup — a new color is a new `--color-*` in `@theme` first.
- **Class names must appear as literals** in source. Tailwind v4's scanner cannot see a class assembled
  from string fragments — write out every branch of a ternary in full.
- **No `console.log`.** The only console calls are `console.assert` / `console.info` in the selftest effect.
- **No abstraction the task didn't ask for**: no config objects, no wrapper with one caller, no helper
  invented "for later". Duplicate twice before extracting.

## Testing

Level `minimal` (declared above). The `?selftest=1` effect in `app/page.tsx` is the only automated check.

- The selftest covers pure helpers only — it never touches Supabase.
- **Run it after every change:** `npm run dev`, open `http://localhost:3000/?selftest=1`, read the console.
  Passing = no failed assertion + the `selftest: เสร็จแล้ว` line. Under React Strict Mode the effect runs
  twice in dev — two `selftest: เสร็จแล้ว` lines is normal.
- **The selftest effect must not read `days` / `booked` state.** Effects in the same commit still see the
  pre-`setState` value, so it computes `buildDays()` / `seedBooked()` locally instead.
- **One assert per non-trivial helper** — anything with a branch, a loop, or an edge case you had to stop
  and think about (`formatRanges`, `totalPrice`, `dateKey`). One-liners get none.
- **Assert messages are Thai and state the rule**, not the code:
  `'ชั่วโมงติดกันต้องรวมเป็นช่วงเดียว'`, not `'formatRanges works'`.
- **Not covered by the selftest — check these in a browser** when you touch the flow:
  step 2 → 3 validation blocking on empty fields, dialog close by button / Esc / backdrop all resetting to
  step 1 with a cleared form, and a fresh booking still showing as full afterwards.

## Architecture of `app/page.tsx`

One `'use client'` component, four ordered blocks: mock data → helpers → state/handlers → JSX.

- **All three `<section>`s stay mounted**, toggled with `hidden={state.step !== N}`.
- `state` holds `{ step, date, court, hours }`; `booked`, `booker`, `invalid`, `done` are separate `useState`.
- `formRef` / `dialogRef` are the only refs. Everything else is JSX.

### Rules that exist for a reason

- **Never conditionally render the step sections.** `{state.step === N && <section/>}` unmounts the form,
  wiping the uncontrolled inputs on back-navigation and making `formRef.current` null for
  `checkValidity()` / `reset()`. This is the highest-risk mistake in this file.
- **`hidden` beats `grid` / `flex`** only because Tailwind v4 preflight ships
  `[hidden]:where(:not([hidden="until-found"])) { display: none !important }`. Don't "fix" it into a
  conditional render.
- **Stable keys** (`key={day.key}`, `key={court.id}`, `key={hour}`) are what preserve keyboard focus
  mid-interaction — the React equivalent of the prototype's "build once, update in place".
- **`days` and `booked` are seeded in a mount effect, never during render.** They derive from `new Date()`,
  so computing them during render (a lazy `useState` initializer included) uses the *server's* timezone
  and guarantees a hydration mismatch.
- **Date keys** use `Intl.DateTimeFormat('en-CA')`, never `toISOString().slice(0,10)` — Thailand is UTC+7,
  so ISO keys are off by one day between 00:00–06:59 local.
- **No `Math.random()` or `new Date()` during render.** Both live in handlers/effects and land in state.
- **`booked` is a sibling of `state`, not a field of it.** It holds Occupancy fetched from
  Supabase, keyed `'YYYY-MM-DD|A'`. The reset must not touch it.
- **The browser talks to Supabase directly and can only reach two things**: the `slot_occupancy`
  view (three columns, no PII) and the `create_booking` function. The `booked_slots` table itself
  is unreachable from the client by design — see
  [docs/adr/0001-browser-talks-to-supabase-directly.md](docs/adr/0001-browser-talks-to-supabase-directly.md).
  **Any validation that matters belongs in the SQL function**, not in the component: the client is
  attacker-controlled, so `checkValidity()` is UX only.
- **Never "check then insert".** The unique constraint on `(court_id, booking_date, hour)` is what
  prevents double-booking; the client maps the resulting `slot_taken` error to Thai copy.
- **A failed Occupancy fetch must never render as "all hours free".** The slot grid stays hidden
  behind a retry affordance, otherwise a database outage silently invites double bookings.
- **The Supabase client is created lazily** in `db()`. Creating it at module scope would crash
  `next build` whenever the env vars are absent.
- **Reset is bound to the dialog's `onClose`**, not the button's click — Esc and backdrop dismiss
  (`closedby="any"`) must reset too, or the user stays on step 3 and can confirm twice.
- **`closedby` is lowercase** on `<dialog>` and needs `@types/react >= 19.2.17`. `closedBy` camelCase both
  TS-errors and mis-renders.
- **Validation** relies on `:user-invalid` so errors appear only after interaction. `checkValidity()` gates
  step 2 → 3 and `reportValidity()` shows the native bubble. Note: in Chromium `reportValidity()` alone does
  *not* flip `:user-invalid` on untouched fields, so the red `.err` text appears only after the user has
  touched them — same as the prototype, verified side by side. Leave it.
- **`aria-invalid` comes from the `invalid` state map**, mirrored by `syncAria` because `:user-invalid`
  doesn't set it. The reset clears it with `setInvalid({})`.

### Styling

Tailwind v4 via PostCSS. [app/globals.css](app/globals.css) holds `@import 'tailwindcss'`, the `@theme`
block with the accents `--color-ball` / `--color-ball-dark` / `--color-court` / `--color-court-light` /
`--color-clay` and the dark surfaces `--color-ink` / `--color-panel` / `--color-panel-2` / `--color-line`,
plus `.court-lines`, the `:user-invalid` error rules, and the reduced-motion killswitch. The UI is dark-only.

`--font-sans` lives in a separate **`@theme inline`** block because it references the CSS variable
`next/font` sets on `<html>` at runtime — a plain `@theme` would inline `var(...)` wrongly at build time.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
