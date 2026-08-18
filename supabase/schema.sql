-- Schema for the tennis booking demo.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Source of truth: .claude/specs/phase-2-supabase-persistence.md §4
-- Rationale: docs/adr/0001-browser-talks-to-supabase-directly.md

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
