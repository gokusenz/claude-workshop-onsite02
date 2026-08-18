# Implementation Spec — Phase 2: persist bookings in Supabase, deploy on Vercel

**Status:** ready to implement. Every open question was settled in the design interview; do not
re-open them. If something here is genuinely underspecified, pick the simplest option that
satisfies the rules in §3 and note it in your report.

**Prerequisites:** Phase 1 is done — the app is Next.js 16 App Router + TypeScript + Tailwind v4,
all UI in `app/page.tsx`. See `CLAUDE.md`. Domain vocabulary: `CONTEXT.md`. The data-access
decision and its consequences: `docs/adr/0001-browser-talks-to-supabase-directly.md` — read it
before writing SQL.

---

## 1. Goal

A booking made on the deployed site survives a reload, a different browser, and a different
person. Two people cannot end up holding the same Slot.

## 2. Scope

**In scope**
- Supabase Postgres holding taken Slots
- Reading Occupancy from the database instead of the hardcoded `seedBooked()`
- Writing a Booking through a validating database function
- Past Slots on today's date disabled and refused
- Visible error handling on the confirm step (there is none today)
- Deployed on Vercel from the GitHub repo

**Out of scope — do not build these**
- Authentication, admin screens, cancellation, "find my booking"
- Rate limiting
- Payments, SMS/email
- Moving Courts / prices / opening hours into the database — they stay constants in `app/page.tsx`
- New tests. Keep the existing `?selftest=1` effect working; add nothing else.

## 3. Locked decisions

| Decision | Choice |
|---|---|
| Database | Supabase Postgres |
| Data access | Browser → Supabase directly with the publishable key. **No Route Handlers, no server-side secret.** See ADR 0001 |
| Concurrency | `UNIQUE (court_id, booking_date, hour)`. The database refuses; the client reports it. Never "check then insert" |
| Time authority | The database. `Asia/Bangkok`, fixed. Stored as `date DATE` + `hour SMALLINT`, never `timestamptz` |
| Booking Reference | Generated in the database, `TN-` + 6 uppercase hex chars |
| Courts / hours / prices | Stay hardcoded in `app/page.tsx` |
| Cancellation | Not built. **Do not add a `status` column "for later"** |
| Past Slots | Disabled in the UI *and* refused by the database |

---

## 4. Database

Run this once in the Supabase SQL editor. It is idempotent enough to re-run after a `drop`.

```sql
-- ══════════ ตารางช่องที่ถูกจอง ══════════
-- หนึ่งแถว = หนึ่ง Slot. หลายแถวที่มี booking_ref เดียวกัน = หนึ่ง Booking
create table public.booked_slots (
  id             bigint generated always as identity primary key,
  booking_ref    text        not null,
  court_id       text        not null,
  booking_date   date        not null,
  hour           smallint    not null,
  customer_name  text        not null,
  customer_phone text        not null,
  note           text,
  created_at     timestamptz not null default now(),

  constraint booked_slots_hour_range check (hour between 9 and 20),
  constraint booked_slots_unique_slot unique (court_id, booking_date, hour)
);

create index booked_slots_date_idx on public.booked_slots (booking_date);

-- ══════════ ปิดตายไม่ให้เบราว์เซอร์แตะตารางนี้ ══════════
-- เปิด RLS โดยไม่สร้าง policy ใด ๆ = anon เข้าไม่ถึงเลย ทั้งอ่านและเขียน
alter table public.booked_slots enable row level security;
revoke all on public.booked_slots from anon, authenticated;

-- ══════════ ช่องทางอ่าน: เห็นแค่ว่าชั่วโมงไหนเต็ม ไม่มีชื่อไม่มีเบอร์ ══════════
create view public.slot_occupancy
with (security_invoker = false) as
  select court_id, booking_date, hour
  from public.booked_slots;

grant select on public.slot_occupancy to anon;

-- ══════════ ช่องทางเขียน: ฟังก์ชันเดียว ตรวจทุกอย่างซ้ำที่ฝั่ง DB ══════════
-- client แก้ได้ทุกอย่าง — การตรวจใน checkValidity() เป็นแค่ UX ไม่ใช่การป้องกัน
create or replace function public.create_booking(
  p_court_id     text,
  p_booking_date date,
  p_hours        int[],
  p_name         text,
  p_phone        text,
  p_note         text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref      text;
  v_today    date     := (now() at time zone 'Asia/Bangkok')::date;
  v_now_hour smallint := extract(hour from (now() at time zone 'Asia/Bangkok'))::smallint;
  v_hour     int;
begin
  if p_court_id not in ('A', 'B', 'C') then
    raise exception 'invalid_court' using errcode = 'P0001';
  end if;

  if p_name is null or length(btrim(p_name)) < 2 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  if p_phone is null or p_phone !~ '^0[0-9]{9}$' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  if p_hours is null or coalesce(array_length(p_hours, 1), 0) not between 1 and 12 then
    raise exception 'invalid_hours' using errcode = 'P0001';
  end if;

  -- Booking Horizon: วันนี้ถึงอีก 6 วัน
  if p_booking_date < v_today or p_booking_date > v_today + 6 then
    raise exception 'date_out_of_range' using errcode = 'P0001';
  end if;

  foreach v_hour in array p_hours loop
    if v_hour < 9 or v_hour > 20 then
      raise exception 'invalid_hours' using errcode = 'P0001';
    end if;
    -- Past Slot: ชั่วโมงที่เริ่มไปแล้วของวันนี้ จองไม่ได้
    if p_booking_date = v_today and v_hour <= v_now_hour then
      raise exception 'slot_in_past' using errcode = 'P0001';
    end if;
  end loop;

  v_ref := 'TN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.booked_slots
    (booking_ref, court_id, booking_date, hour, customer_name, customer_phone, note)
  select
    v_ref, p_court_id, p_booking_date, h, btrim(p_name), p_phone,
    nullif(btrim(coalesce(p_note, '')), '')
  from unnest(p_hours) as h;

  return v_ref;

exception
  when unique_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
end;
$$;

revoke execute on function public.create_booking(text, date, int[], text, text, text) from public;
grant  execute on function public.create_booking(text, date, int[], text, text, text) to anon;
```

**Why it is shaped this way**
- The whole `insert ... select from unnest(...)` is one statement, so one conflicting hour rolls
  back the entire Booking. Partial bookings are impossible.
- `gen_random_uuid()` is in `pg_catalog` on Postgres 13+, so it needs no extension and is
  unaffected by `search_path`. Do not swap it for `gen_random_bytes` (that needs `pgcrypto`).
- Every `raise` uses errcode `P0001` and a stable machine-readable message. The client maps the
  message, never the human text.

**Known accepted debt:** the valid court letters appear twice — in `COURTS` in `app/page.tsx`
and in the `p_court_id not in (...)` check. That is the cost of keeping Courts in code. If a
court is ever added, both change. Do not "fix" this by moving Courts to a table; that was
explicitly ruled out of scope.

## 5. Client

### 5.1 Dependency and client instance

```sh
npm install @supabase/supabase-js
```

Create the client **lazily**, in one `db()` helper at module scope in `app/page.tsx` — not inside
the component, not in a new file. Lazily, because creating it eagerly crashes `next build` when
the env vars are absent, which is exactly the state a fresh clone is in:

```ts
let client: SupabaseClient | undefined
function db() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) throw new Error('missing_supabase_env')
    client = createClient(url, key)
  }
  return client
}
```

`missing_supabase_env` flows through the same error map as every other failure (§5.5), so a
misconfigured deployment says so on screen instead of failing silently.

Both variables are inlined at build time by Next, so they must exist in Vercel *before* the
build. See §7.

### 5.2 Reading Occupancy

Replace `seedBooked(list)` in the mount effect. Keep `booked` in exactly its current shape —
`Record<'YYYY-MM-DD|A', number[]>` — so none of the rendering code changes.

```ts
async function fetchOccupancy(days: Day[]): Promise<Booked> {
  const { data, error } = await supabase
    .from('slot_occupancy')
    .select('court_id,booking_date,hour')
    .gte('booking_date', days[0].key)
    .lte('booking_date', days[days.length - 1].key)

  if (error) throw error

  return data.reduce<Booked>((acc, row) => {
    const key = `${row.booking_date}|${row.court_id}`
    return { ...acc, [key]: [...(acc[key] ?? []), row.hour] }
  }, {})
}
```

The mount effect becomes async. Requirements:
- While it is in flight, the slot grid must not claim everything is free. Add a `loading` state
  and disable the hour buttons until Occupancy has arrived.
- If it fails, show a retry affordance rather than a silently empty grid — an unavailable
  database must never look like "all hours available".
- It still must not run during SSR. Keep the existing mount-effect pattern from Phase 1 and its
  comment; the hydration rule in `CLAUDE.md` has not changed.

### 5.3 Past Slots

Compute the current Bangkok hour once, in the same mount effect, and store it in state:

```ts
const nowHour = Number(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date()),
)
```

A Slot is a Past Slot when `date === days[0].key && hour <= nowHour`.
Use `hourCycle: 'h23'`, not `hour12: false` — the latter yields `"24"` for midnight under
some ICU builds, which would silently disable every Slot for the first hour of the day.

Render it disabled like a taken Slot but with the label **"ผ่านไปแล้ว"** instead of "เต็ม", and a
visibly different style from a taken Slot (they are different states — see `CONTEXT.md`).
This value is computed once at mount and does not tick; a page left open across the hour
boundary keeps the stale value. That is acceptable because §4 rejects the booking anyway.

### 5.4 Writing a Booking

`confirmBooking` becomes async:

```ts
const { data: ref, error } = await supabase.rpc('create_booking', {
  p_court_id: state.court,
  p_booking_date: state.date,
  p_hours: state.hours,
  p_name: booker.name,
  p_phone: booker.phone,
  p_note: booker.note || null,
})
```

Rules:
- Disable the ยืนยันการจอง button while the call is in flight — double-submitting creates two
  Bookings on adjacent hours or one confusing `slot_taken`.
- **On success:** set `done` from the returned `ref`, re-run `fetchOccupancy` so the new Slots
  show as taken, then `showModal()`. Do not merge the new hours into `booked` by hand — refetch
  is the single source of truth and it also picks up other people's bookings.
- **On failure:** stay on step 3, show the error, leave the form data intact. Never open the
  success dialog.

### 5.5 Error mapping

Map `error.message` — the machine string from §4 — to Thai copy. Anything unrecognised gets the
fallback; never render a raw Postgres message to a user.

| `error.message` | ข้อความที่แสดง |
|---|---|
| `slot_taken` | ช่วงเวลานี้เพิ่งถูกจองไปแล้ว กรุณาเลือกใหม่ |
| `slot_in_past` | ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกใหม่ |
| `date_out_of_range` | จองได้ล่วงหน้าไม่เกิน 7 วัน |
| `invalid_phone` | เบอร์โทรไม่ถูกต้อง ต้องเป็น 10 หลัก ขึ้นต้นด้วย 0 |
| `invalid_name` | กรุณากรอกชื่อ-นามสกุล อย่างน้อย 2 ตัวอักษร |
| `invalid_court` / `invalid_hours` | ข้อมูลการจองไม่ถูกต้อง กรุณาเริ่มใหม่ |
| anything else / network failure | จองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง |

For `slot_taken` and `slot_in_past`, also re-run `fetchOccupancy` before showing the message —
the user's next action is picking another hour and the grid must already be correct.

The error needs somewhere to live in step 3. There is no error UI today. Add one region above
the price footer, styled with the existing `text-red-400` and `bg-panel` tokens, and give it
`role="alert"` so it is announced. **No new colors** — a new color means a new `@theme` token
first (`CLAUDE.md`).

## 6. Files

| File | Change |
|---|---|
| `app/page.tsx` | Everything in §5. Still one client component — do not split |
| `package.json` | `@supabase/supabase-js` |
| `.env.local` | Local dev credentials, gitignored (`.env*` is already covered) |
| `CLAUDE.md` | Update Commands (needs `.env.local`) and Architecture (Occupancy now comes from Supabase; `seedBooked` is gone). Keep the existing rules section intact |
| `.claude/specs/`, `docs/adr/`, `CONTEXT.md` | Reference only — do not edit |

`seedBooked()` is deleted. The `?selftest=1` assertion that referenced it must be replaced with
one that does not touch the database — assert `formatRanges` / `totalPrice` / `dateKey` only, and
keep the rule from `CLAUDE.md` that the selftest effect never reads `days`/`booked` state.

## 7. Deploy

1. Create a Supabase project (region Singapore — nearest to Thailand).
2. Run §4 in the SQL editor. Verify: `select * from slot_occupancy;` returns 0 rows without error.
3. Copy the project URL and the **publishable key** (`sb_publishable_…`) from Project Settings →
   API. Do **not** copy the secret key; nothing in this app uses it.
4. Local: put both in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then `npm run dev`.
5. Vercel: import the GitHub repo `gokusenz/claude-workshop-onsite02` under the **LBX** team,
   set the same two variables for Production **and** Preview, then deploy. They are
   `NEXT_PUBLIC_*`, so they are baked into the bundle at build time — setting them after a build
   requires a redeploy, not just a restart.
6. GitHub Pages currently serves the old prototype from the repo root and 404s since Phase 1.
   Either disable Pages or leave it; Vercel is the live deployment now.

## 8. Verification

Database, from the Supabase SQL editor:
- Insert the same `(court_id, booking_date, hour)` twice → the second fails with `23505`.
- `select public.create_booking('A', current_date, array[9], 'ทดสอบ ระบบ', '0812345678')` when
  the Bangkok hour is past 09:00 → fails with `slot_in_past`.
- `select public.create_booking('Z', current_date + 1, array[10], 'ทดสอบ ระบบ', '0812345678')`
  → fails with `invalid_court`.
- As the `anon` role: `select * from booked_slots` → permission denied.
  `select * from slot_occupancy` → works, and has no name or phone column.

Application, in a browser against `npm run dev`:
1. Book a Slot. Hard-reload. It still shows เต็ม. **This is the whole point of the phase.**
2. Open the same page in a second browser profile. The Slot is เต็ม there too.
3. Two browsers on step 3 for the same Slot; confirm in both. First succeeds, second shows
   "ช่วงเวลานี้เพิ่งถูกจองไปแล้ว" and its grid updates — no success dialog, no duplicate row.
4. Any hour earlier than now, today, is disabled and labelled ผ่านไปแล้ว.
5. Break the Supabase URL in `.env.local` and reload: the grid does not render as all-free, and
   an error with a retry is visible.
6. `?selftest=1` still passes; console has no errors and no hydration warnings.
7. `npm run build` succeeds.

## 9. Accepted risks

Stated so nobody discovers them later and thinks they are bugs.

- **The publishable key is a public write endpoint.** Anyone can script `create_booking` and fill
  the calendar. No auth and no rate limiting was a deliberate choice for a workshop demo.
- **Customer names and phone numbers are stored in plain text** with no retention policy and no
  way to delete them from the app.
- **Booking References are not unique-constrained.** 6 hex characters collide at roughly a
  one-in-sixteen-million rate per pair; with no lookup feature, nothing depends on uniqueness yet.
- **A Booking is only implied**, by rows sharing a `booking_ref`. Adding cancellation later means
  either trusting that grouping or introducing a real Bookings table.
