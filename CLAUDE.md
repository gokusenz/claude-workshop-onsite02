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

## Coding Style

Style rules for `index.html` — they follow what the file already does, not a generic style guide.

- **No dependencies, no build step.** Vanilla DOM + the Tailwind CDN. Adding npm, a bundler,
  or a framework ends the demo — say so instead of doing it.
- **One file, four ordered blocks.** New code goes into the block it belongs to
  (mock data → helpers → build-once DOM → `render()`), never into a new file or a new block.
- **Immutable state.** `setState(patch)` replaces `state`; `booked` is reassigned, never pushed to.
  No `state.x = …`, no `arr.push()` on anything that renders.
- **Pure helpers are `const` arrows** (`formatRanges`, `totalPrice`, `esc`); flow and rendering are
  `function` declarations (`render`, `renderSummary`, `confirmBooking`). Keep the split.
- **Format:** 2 spaces, single quotes, no semicolons, no trailing commas — match the surrounding lines.
- **Language:** identifiers and this file in English; UI copy and code comments in Thai.
- **Colors go through the `@theme` tokens** (`bg-ball`, `text-court`, `border-line`, …). No raw hex
  in markup — a new color is a new `--color-*` in `@theme` first.
- **`esc()` before any `innerHTML`** that can contain what the user typed.
- **No `console.log`.** The only console calls in the file are `console.assert` / `console.info`
  inside `selfTest()`.
- **No abstraction the task didn't ask for**: no config objects, no wrapper with one caller,
  no helper invented "for later". Duplicate twice before extracting.

## Testing

Level `minimal` (declared above). `selfTest()` at the end of `index.html` is the only automated check —
there is no runner, and adding one is out of scope for this demo.

- **Run it after every change:** `open "index.html?selftest=1"`, then read the console.
  Passing = no failed assertion + the `selftest: เสร็จแล้ว` line.
- **One assert per non-trivial helper.** Anything with a branch, a loop, or an edge case you had to
  stop and think about (`formatRanges`, `totalPrice`, `dateKey`) gets at least one. One-liners get none.
- **Assert messages are Thai and state the rule**, not the code:
  `'ชั่วโมงติดกันต้องรวมเป็นช่วงเดียว'`, not `'formatRanges works'`.
- **DOM asserts set up with `setState(...)` first**, then query the built-once nodes
  (see the `booked` slot check at the bottom of the file). Never build throwaway DOM for a test.
- **Not covered by `selfTest()` — check these by hand** when you touch the flow:
  step 2 → 3 validation (empty fields must show errors), dialog close by button / Esc / backdrop all
  resetting to step 1, and a fresh booking still showing as full afterwards.

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

Tailwind v4 browser CDN + an `@theme` block defining the accents `--color-ball` / `--color-court` /
`--color-clay` and the dark surfaces `--color-ink` / `--color-panel` / `--color-panel-2` / `--color-line`
(usable as `bg-ball`, `text-court`, `border-line`, …). The UI is dark-only. If jsdelivr is blocked, swap to `https://cdn.tailwindcss.com`
and move the colors into an inline `tailwind.config`. UI copy is Thai.
