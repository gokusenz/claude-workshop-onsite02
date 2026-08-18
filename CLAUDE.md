# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Workshop demo: a tennis court booking flow. Everything lives in `index.html` — no build step,
no package.json, no backend. Mock data only.

Testing level: minimal

## Commands

```sh
open index.html                # run it
open "index.html?selftest=1"   # run the console.assert self-check (see selfTest() at end of file)
```

There is no bundler, linter, or test runner. `selfTest()` is the only automated check; add asserts
there rather than introducing a framework.

## Architecture of `index.html`

Single file, four ordered blocks inside one `<script>`: mock data → helpers → build-once DOM → `render()`.

- **No framework.** All three steps exist in the DOM at once as `<section data-step="N">`;
  `render()` toggles `hidden` and rewrites classes. `setState(patch)` replaces `state` immutably
  and calls `render()` — never mutate `state`.
- **Build once, update in place.** Day chips, court cards, and the 12 slot buttons are created once
  at load. `render()` only updates their classes / `disabled` / `aria-pressed`. Do not rebuild these
  nodes on each render — it would drop keyboard focus mid-interaction.
- **The form is not re-rendered.** Inputs are static HTML; values are read via `form.elements.name`
  (`form.name` is the form's own name property, not the input).

### Rules that exist for a reason

- **Date keys** use `Intl.DateTimeFormat('en-CA')`, never `toISOString().slice(0,10)` — Thailand is
  UTC+7, so ISO keys are off by one day between 00:00–06:59 local.
- **`booked` lives outside `state`** and is reassigned immutably. It must survive the reset in the
  dialog's `close` handler, otherwise a just-made booking stops showing as full.
- **Reset is bound to the dialog's `close` event**, not the button's click — Esc and backdrop
  dismiss (`closedby="any"`) must reset too, or the user stays on step 3 and can confirm twice.
- **Validation** relies on `:user-invalid` so errors appear only after interaction. `checkValidity()`
  gates step 2 → 3; `reportValidity()` is what makes untouched empty fields show their error state.
- **`esc()` before `innerHTML`** for anything the user typed (summary rows).

### Styling

Tailwind v4 browser CDN + an `@theme` block defining `--color-ball` / `--color-court` / `--color-clay`
(usable as `bg-ball`, `text-court`, …). If jsdelivr is blocked, swap to `https://cdn.tailwindcss.com`
and move the colors into an inline `tailwind.config`. UI copy is Thai.
