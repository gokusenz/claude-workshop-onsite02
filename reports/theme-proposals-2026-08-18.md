# Theme proposals — 11 directions (2026-08-18)

11 independent agents each designed one theme direction against the 14-token `@theme` contract in
[app/globals.css](../app/globals.css). **US Open Night Session is the one currently applied.** Every
other block below is a paste-ready swap.

## How to swap a theme

1. Replace the whole `@theme { … }` block in `app/globals.css` with the one below.
2. Replace the two `.court-lines` `rgba(…)` values in the same file.
3. Replace the `backdrop:` class on the `<dialog>` in `app/page.tsx` (currently `backdrop:bg-ink/85`).
4. `.field:user-invalid` needs no edit — it already reads `var(--color-danger)` /
   `var(--color-danger-bg)`.
5. Light themes only: apply the alpha-overlay swaps listed for that theme, **and** the two `text-ball`
   remaps described under "The light-theme blocker" below.
6. `npm run build`, then look at it on `localhost:3000`.

## The light-theme blocker — read before shipping any light theme

`--color-ball` is pulled in two directions at once:

- `bg-ball` + `text-court` (confirm button, `app/page.tsx:548`) needs ball **light** enough for
  near-black text to reach 4.5:1
- `text-ball` needs ball **dark** enough to reach 4.5:1 on a light card

On a dark theme both pull the same way. On a light theme they conflict, and the confirm button wins.

`text-ball` is **not** only the big price. Two sites are normal-size text and need 4.5:1, not 3:1:

| site | markup | size |
|---|---|---|
| `app/page.tsx:286` | active step label, `font-bold text-ball` inside a `text-sm` list | 14px bold |
| `app/page.tsx:338` | selected court price, `font-bold` at base size | 16px bold — under WCAG's 18.66px-bold "large" threshold |
| `app/page.tsx:520` | total price, `text-3xl` | genuinely large, 3:1 is fine |

Measured across all 11 proposals: **all 4 dark themes pass, all 7 light themes fail** (`text-ball` on
`bg-ink` lands 2.76–3.43:1 against a 4.5 requirement). Three agents derived this independently and
converged on the same remedy:

- step label → `text-court font-bold` instead of `text-ball`
- selected slot / price → a `bg-ball text-court` chip instead of `text-ball`

Do those two edits first, then a light theme is shippable.

## Verified contrast summary

Recomputed independently with the WCAG 2.x relative-luminance formula — these numbers are not the
agents' self-reports (they matched to 2 decimals in every case).

| theme | base | ball/panel | ball/ink | court/ball | mute/panel | mute-2/panel-2 | danger/panel | small-text `text-ball` |
|---|---|---|---|---|---|---|---|---|
| **US Open** ← applied | dark | 14.62 | 17.47 | 7.70 | 7.31 | 4.75 | 6.57 | **PASS** |
| Neon Night | dark | 12.44 | 13.32 | 9.88 | 8.00 | 5.58 | 6.07 | **PASS** |
| Sunset Hard Court | dark | 9.62 | 11.00 | 7.38 | 8.10 | 5.01 | 7.67 | **PASS** |
| Emerald & Brass | dark | 7.52 | 8.36 | 5.31 | 6.33 | 4.75 | 6.90 | **PASS** |
| Brutalist Mono | light | 3.84 | 3.43 | 5.46 | 8.86 | 4.56 | 7.33 | FAIL (3.43) |
| Nordic Bone | light | 3.73 | 3.33 | 4.71 | 7.72 | 4.58 | 6.56 | FAIL (3.33) |
| Pastel Court | light | 3.46 | 3.15 | 4.71 | 6.28 | 4.66 | 5.62 | FAIL (3.15) |
| Roland-Garros Clay | light | 3.48 | 3.12 | 4.81 | 7.13 | 4.77 | 6.91 | FAIL (3.12) |
| Andaman Morning | light | 3.44 | 3.14 | 5.06 | 6.59 | 4.75 | 5.44 | FAIL (3.14) |
| Wimbledon Lawn | light | 3.26 | 2.90 | 5.38 | 6.40 | 4.70 | 6.38 | FAIL (2.90) |
| Retro 70s | light | 3.17 | 2.76 | 5.07 | 6.44 | 5.61 | 6.11 | FAIL (2.76) |

Note: the theme that shipped before this work had `mute-2` on `panel-2` at **3.32:1** — below the 4.5
floor. Every proposal above fixes it.

---

# Dark themes — drop-in ready

## 1. US Open Night Session ★ applied

Midnight navy, the blue hard court under floodlights, optic yellow as the only eye-guide.

```css
@theme {
  --color-ball: #e3ff3a;        /* เหลืองออปติก — ปุ่มยืนยัน, ราคา, ช่องที่เลือก */
  --color-ball-dark: #c2e224;   /* เหลืองออปติกหม่นลง — hover ปุ่มยืนยัน */
  --color-court: #1a4a8f;       /* น้ำเงินฮาร์ดคอร์ตใต้ไฟสนาม — header, แถบราคารวม, ปุ่มใน dialog */
  --color-court-light: #2a68c8; /* น้ำเงินคอร์ตสว่างขึ้น — court hover */
  --color-clay: #1f6b48;        /* เขียวขอบสนาม — ยังไม่ถูกใช้ */
  --color-ink: #050a1c;
  --color-panel: #101c45;
  --color-panel-2: #1d2d64;
  --color-line: #31427f;
  --color-fg: #f2f6ff;
  --color-mute: #9aacdd;
  --color-mute-2: #8a9bce;
  --color-danger: #ff7a85;
  --color-danger-bg: #3b1220;
}
```

- `.court-lines`: `rgba(255,255,255,.20)` / `rgba(255,255,255,.14)`
- backdrop: `backdrop:bg-ink/85`
- alpha overlays: no change
- applied tweak: total price got `font-extrabold tracking-tight`

Why `#1a4a8f` and not a brighter blue: the header subtitle is `text-white/70`, which drops to 4.12:1
on `#2472d0`. At `#1a4a8f` it measures 5.16:1.

## 2. Neon Night Court

Cyberpunk floodlights — electric cyan on near-black, deep magenta header.

```css
@theme {
  --color-ball: #22e6ff;        /* ไซแอนไฟฟ้า */
  --color-ball-dark: #00c8e0;
  --color-court: #4a0b3a;       /* แม็กเจนต้าเข้ม */
  --color-court-light: #b81a8c;
  --color-clay: #e9fbff;
  --color-ink: #05060d;
  --color-panel: #0d1020;
  --color-panel-2: #171b2e;
  --color-line: #313d68;
  --color-fg: #eaf4ff;
  --color-mute: #9aa9c9;
  --color-mute-2: #8593ba;
  --color-danger: #ff5470;
  --color-danger-bg: #300d14;
}
```

- `.court-lines`: `rgba(34,230,255,.22)` / `rgba(255,79,201,.16)` — cyan verticals, magenta horizontals
- backdrop: `backdrop:bg-ink/85 backdrop:backdrop-blur-sm`
- alpha overlays: no change
- optional tweaks: glow shadows on the confirm button, logo circle and selected slot
  (`shadow-[0_0_24px_-6px_var(--color-ball)]`); `border-b border-ball/40` on the header;
  `font-mono tabular-nums` on the price

## 3. Sunset Hard Court

Golden hour over Bangkok — plum base, amber and coral accents.

```css
@theme {
  --color-ball: #ffb45c;        /* แอมเบอร์ทอง */
  --color-ball-dark: #f0973a;
  --color-court: #4b1f52;       /* พลัมลึก */
  --color-court-light: #6d2f76;
  --color-clay: #ff8a63;
  --color-ink: #130a19;
  --color-panel: #241635;
  --color-panel-2: #33204a;
  --color-line: #4a2f60;
  --color-fg: #fbeef2;
  --color-mute: #c9aac6;
  --color-mute-2: #a98fb0;
  --color-danger: #ff8f85;
  --color-danger-bg: #3a1620;
}
```

- `.court-lines`: `rgba(255,214,170,.16)` / `rgba(255,214,170,.11)` — cream-orange, reads as sunlight
- backdrop: `backdrop:bg-ink/85`
- alpha overlays: no change
- optional tweaks: `shadow-lg shadow-black/40` on the header; cards `rounded-xl` → `rounded-2xl`

## 4. Emerald & Brass

Members-only club — charcoal and deep emerald, brushed brass, ivory text.

```css
@theme {
  --color-ball: #c9a45c;        /* ทองเหลืองด้าน */
  --color-ball-dark: #be9a52;
  --color-court: #0f3b2e;       /* มรกตลึก */
  --color-court-light: #1a6b52;
  --color-clay: #ede7d9;
  --color-ink: #0a0c0b;
  --color-panel: #141a18;
  --color-panel-2: #1e2523;
  --color-line: #303733;
  --color-fg: #f2efe6;
  --color-mute: #a29a8c;
  --color-mute-2: #948d80;
  --color-danger: #e38a80;
  --color-danger-bg: #2b1715;
}
```

- `.court-lines`: `rgba(201,164,92,.16)` / `rgba(201,164,92,.10)` — gold lines instead of white
- backdrop: `backdrop:bg-ink/85`
- alpha overlays: no change
- optional tweaks: cards `rounded-2xl` → `rounded-lg`; confirm button `shadow-lg` → `shadow-none`;
  price `tabular-nums`
- deliberately **no** `tracking-*`: letter-spacing on Thai breaks vowel and tone-mark placement
- `#be9a52` was chosen over `#b8934b` because the latter puts the hover state at 4.34:1

---

# Light themes — need the two `text-ball` remaps first

Each of these fails small-text `text-ball` as shipped. Apply the remaps from "The light-theme
blocker" above, then they are fine.

## 5. Brutalist Mono — paper / ink / safety orange

Swiss-poster severity: paper grey ground, pure black ink for all text and every border, one shouting
orange.

```css
@theme {
  --color-ball: #ee4400;
  --color-ball-dark: #d93e00;
  --color-court: #000000;       /* ดำสนิท — header ยังเป็นพื้นมืด */
  --color-court-light: #2b2b2b;
  --color-clay: #b4b4b4;
  --color-ink: #f2f2f2;
  --color-panel: #ffffff;
  --color-panel-2: #e5e5e5;
  --color-line: #000000;
  --color-fg: #000000;
  --color-mute: #4a4a4a;
  --color-mute-2: #666666;
  --color-danger: #b00020;
  --color-danger-bg: #ffe1e5;
}
```

- `.court-lines`: `rgba(255,255,255,.18)` / `rgba(255,255,255,.12)`
- backdrop: `backdrop:bg-black/75`
- alpha overlays: `text-white/70` and any `border-white/10` **on `bg-court`** stay (court is `#000000`);
  elsewhere `border-white/10` → `border-black/20`, `ring-1 ring-white/10` → `ring-0`,
  `divide-white/10` → `divide-black/25`, `hover:bg-white/5` → `hover:bg-black/5`
- tweaks (this theme *is* its tweaks): every radius → `rounded-none` including the logo circle;
  `border` → `border-2 border-line` on cards/fields with ring removed;
  `shadow-[6px_6px_0_0_var(--color-line)]` on the confirm button and logo;
  `active:translate-x-[6px] active:translate-y-[6px] active:shadow-none` on the confirm button;
  sticky bars get `border-t-2` / `border-b-2 border-line`

## 6. Nordic Bone

Scandinavian calm — warm bone ground, clean white cards, one muted sage accent.

```css
@theme {
  --color-ball: #778a6c;
  --color-ball-dark: #6f8a60;
  --color-court: #121a21;
  --color-court-light: #1e2a33;
  --color-clay: #e7e2d8;
  --color-ink: #f4f2ed;
  --color-panel: #ffffff;
  --color-panel-2: #e9e5dc;
  --color-line: #d8d3c8;
  --color-fg: #23292d;
  --color-mute: #4a545e;
  --color-mute-2: #5d6771;
  --color-danger: #a33a2e;
  --color-danger-bg: #f7e7e3;
}
```

- `.court-lines`: `rgba(255,255,255,.09)` / `rgba(255,255,255,.06)`
- backdrop: `backdrop:bg-court/30`
- alpha overlays: `text-white/70` stays (on dark `bg-court`); `border-white/10` → `border-black/10`,
  `ring-white/10` → `ring-black/5`, `divide-white/10` → `divide-black/10`,
  `hover:bg-white/5` → `hover:bg-black/5`
- tweaks: cards `shadow-lg` → `shadow-none`, `p-4` → `p-6`, `rounded-2xl` → `rounded-lg`,
  buttons/inputs `rounded-xl` → `rounded-md`; confirm button `font-medium tracking-wide`
- `border-line` is decorative here at ~1.49:1 — for WCAG 1.4.11 give `.field` `border-mute-2` instead

## 7. Pastel Court

Pastels held to surfaces only; text and accent go deep-saturated so contrast survives.

```css
@theme {
  --color-ball: #ec5088;
  --color-ball-dark: #f26a9b;   /* hover สว่างขึ้น ไม่ใช่เข้มลง — ธีมสว่างกลับทิศ */
  --color-court: #06251c;
  --color-court-light: #12503c;
  --color-clay: #fff3d8;
  --color-ink: #f6f3fb;
  --color-panel: #ffffff;
  --color-panel-2: #f4effa;
  --color-line: #cbc0df;
  --color-fg: #1e1b29;
  --color-mute: #635c7a;
  --color-mute-2: #6f6884;
  --color-danger: #c62348;
  --color-danger-bg: #fde7ec;
}
```

- `.court-lines`: `rgba(214,246,231,.18)` / `rgba(214,246,231,.12)`
- backdrop: `backdrop:bg-court/45`
- alpha overlays: `text-white/70` stays; `ring-white/10` → `ring-line`, `divide-white/10` →
  `divide-line`, `border-white/10` → `border-line` (except on `bg-court`),
  `hover:bg-white/5` → `hover:bg-black/5` on light surfaces / `hover:bg-white/10` on court
- tweaks: header `rounded-b-3xl`; cards `rounded-3xl` + `shadow-sm`; slot/date chips `rounded-xl`;
  dialog `backdrop:backdrop-blur-[2px]`

## 8. Roland-Garros Clay

Parisian red clay — cream chalk ground, brick-orange accent, forest-green trim.

```css
@theme {
  --color-ball: #d9662f;
  --color-ball-dark: #d75f22;
  --color-court: #052017;
  --color-court-light: #0f4a33;
  --color-clay: #a8421f;
  --color-ink: #f7efe1;
  --color-panel: #fffcf7;
  --color-panel-2: #f7ecdd;
  --color-line: #ab8352;
  --color-fg: #2b1c12;
  --color-mute: #6b5140;
  --color-mute-2: #7d6350;
  --color-danger: #a8271b;
  --color-danger-bg: #fbe6e1;
}
```

- `.court-lines`: `rgba(250,241,227,.18)` / `rgba(250,241,227,.12)`
- backdrop: `backdrop:bg-court/60`
- alpha overlays: `text-white/70` stays; `ring-white/10` → `ring-black/10`,
  `border-white/10` → `border-black/10` (except on `bg-court`),
  `divide-white/10` → `divide-black/10`, `hover:bg-white/5` → `hover:bg-black/5`
- tweaks: cards `shadow-sm`; sticky bars get `border-t border-line` / `border-b border-line`;
  header heading `tracking-tight`

## 9. Andaman Morning

A seaside resort court — sand, turquoise, sun-bleached white.

```css
@theme {
  --color-ball: #1099a3;
  --color-ball-dark: #0f9099;
  --color-court: #041d25;       /* ทะเลลึก — เป็นสีตัวอักษรบนปุ่ม ball ด้วย จึงต้องเข้มสุดในชุด */
  --color-court-light: #0a3d4a;
  --color-clay: #f2b49a;
  --color-ink: #eef6f9;
  --color-panel: #ffffff;
  --color-panel-2: #f7efe3;
  --color-line: #6b909d;
  --color-fg: #0b2b34;
  --color-mute: #3e6270;
  --color-mute-2: #586d78;
  --color-danger: #c0392b;
  --color-danger-bg: #fdece7;
}
```

- `.court-lines`: `rgba(247,239,227,.16)` / `rgba(247,239,227,.11)`
- backdrop: `backdrop:bg-court/50`
- alpha overlays: `text-white/70` stays; `ring-white/10` → `ring-black/5`,
  `border-white/10` → `border-black/10` (except on `bg-court`),
  `divide-white/10` → `divide-black/10`, `hover:bg-white/5` → `hover:bg-black/5`
- tweaks: cards `rounded-3xl` + `shadow-sm`; sticky bars `backdrop-blur-md`
- `border-line` is deliberately dark here so input borders clear WCAG 1.4.11 (3.02–3.44:1)

## 10. Wimbledon Lawn

Ivory programme paper, near-black aubergine header, grass green as the button colour.

```css
@theme {
  --color-ball: #419e62;
  --color-ball-dark: #3a9455;
  --color-court: #1b1033;
  --color-court-light: #33205c;
  --color-clay: #a8203c;
  --color-ink: #f3efe3;
  --color-panel: #fffcf4;
  --color-panel-2: #f0eadb;
  --color-line: #cfc5ac;
  --color-fg: #241b33;
  --color-mute: #64596f;
  --color-mute-2: #6b6478;
  --color-danger: #b3261e;
  --color-danger-bg: #fbe7e4;
}
```

- `.court-lines`: `rgba(255,252,244,.13)` / `rgba(255,252,244,.09)`
- backdrop: `backdrop:bg-court/60`
- alpha overlays: `text-white/70` stays; the rest → `border-court/10`, `ring-court/10`,
  `divide-court/10`, `hover:bg-court/5`
- tweaks: cards `shadow-sm` + `border border-line`; radii → `rounded-md`;
  price `font-serif tabular-nums` — **digits only**, never `font-serif` on Thai text (unreliable fallback)
- mid-tone Wimbledon purple (`#52307C`) is mathematically impossible here: it forces ball's luminance
  outside the window the confirm button needs, so the purple moved to the header and green became the accent

## 11. Retro 70s Tennis Club

Borg era — warm cream paper, espresso header with faded teal court lines, muted mustard.

```css
@theme {
  --color-ball: #b4801c;
  --color-ball-dark: #c4841c;   /* hover สว่างขึ้น เพราะพื้นเป็นธีมสว่าง */
  --color-court: #241608;
  --color-court-light: #a64b1e;
  --color-clay: #2e6b60;
  --color-ink: #f0e4ce;
  --color-panel: #fbf4e5;
  --color-panel-2: #fffcf5;
  --color-line: #dcc49c;
  --color-fg: #2b1e12;
  --color-mute: #6b5535;
  --color-mute-2: #7a6242;
  --color-danger: #a8321a;
  --color-danger-bg: #fadfd4;
}
```

- `.court-lines`: `rgba(126,188,172,.20)` / `rgba(126,188,172,.13)` — vintage teal, the signature of this theme
- backdrop: `backdrop:bg-court/50`
- alpha overlays: `text-white/70` and `border-white/10` **on `bg-court`** stay; elsewhere
  `border-white/10` → `border-black/10`, `ring-white/10` → `ring-black/10`,
  `divide-white/10` → `divide-black/10`, `hover:bg-white/5` → `hover:bg-black/5`
- tweaks: cards `shadow-none` + `border-2`; buttons and slot chips → `rounded-full`;
  price `font-black tabular-nums`
- worst small-text `text-ball` of the set (2.76:1) — the remaps are mandatory, not optional
