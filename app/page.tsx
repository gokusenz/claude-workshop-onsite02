'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// สร้าง client แบบ lazy — ถ้าสร้างตอนโหลด module หน้าจะพังตอน build เมื่อยังไม่ตั้ง env
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

// ─────────────── Mock Data ───────────────
type Court = { id: string, name: string, surface: string, price: number }
type Day = { key: string, weekday: string, dayMonth: string, full: string, isToday: boolean }
type Booked = Record<string, number[]>

const COURTS: Court[] = [
  { id: 'A', name: 'คอร์ท A', surface: 'ฮาร์ดคอร์ท · กลางแจ้ง', price: 250 },
  { id: 'B', name: 'คอร์ท B', surface: 'ฮาร์ดคอร์ท · กลางแจ้ง', price: 250 },
  { id: 'C', name: 'คอร์ท C', surface: 'อะคริลิก · มีหลังคา', price: 350 },
]

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
const STEP_LABELS = ['เลือกวัน-เวลา', 'ข้อมูลผู้จอง', 'ยืนยันการจอง']

// ไทยเป็น UTC+7 — toISOString().slice(0,10) จะเพี้ยนไปหนึ่งวันช่วง 00:00–06:59
const dateKey = (d: Date) => new Intl.DateTimeFormat('en-CA').format(d)
const fmtWeekday = new Intl.DateTimeFormat('th-TH', { weekday: 'short' })
const fmtDayMonth = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const fmtFull = new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' })

const buildDays = (): Day[] =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      key: dateKey(d),
      weekday: fmtWeekday.format(d),
      dayMonth: fmtDayMonth.format(d),
      full: fmtFull.format(d),
      isToday: i === 0,
    }
  })

// ชั่วโมงปัจจุบันตามเวลาไทย ใช้ปิดช่องที่ผ่านไปแล้วของวันนี้
// ต้องใช้ hourCycle 'h23' — hour12:false ให้ "24" ตอนเที่ยงคืนใน ICU บางรุ่น
const bangkokHour = () =>
  Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()))

// ─────────────── Helpers ───────────────
const hhmm = (h: number) => `${String(h).padStart(2, '0')}:00`
const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`
const courtOf = (id: string | null) => COURTS.find((c) => c.id === id)
const bookedHours = (booked: Booked, date: string, court: string | null) => booked[`${date}|${court}`] ?? []
const totalPrice = (courtId: string | null, hours: number[]) => (courtOf(courtId)?.price ?? 0) * hours.length

/** รวมชั่วโมงที่ติดกันเป็นช่วงเดียว: [10,11,12] → "10:00 – 13:00" */
const formatRanges = (hours: number[]) => {
  const sorted = [...hours].sort((a, b) => a - b)
  const ranges = sorted.reduce<{ start: number, end: number }[]>((acc, h) => {
    const last = acc.at(-1)
    return last && h === last.end ? [...acc.slice(0, -1), { ...last, end: h + 1 }] : [...acc, { start: h, end: h + 1 }]
  }, [])
  return ranges.map((r) => `${hhmm(r.start)} – ${hhmm(r.end)}`).join(', ')
}

const ERROR_TEXT: Record<string, string> = {
  slot_taken: 'ช่วงเวลานี้เพิ่งถูกจองไปแล้ว กรุณาเลือกใหม่',
  slot_in_past: 'ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกใหม่',
  date_out_of_range: 'จองได้ล่วงหน้าไม่เกิน 7 วัน',
  invalid_phone: 'เบอร์โทรไม่ถูกต้อง ต้องเป็น 10 หลัก ขึ้นต้นด้วย 0',
  invalid_name: 'กรุณากรอกชื่อ-นามสกุล อย่างน้อย 2 ตัวอักษร',
  invalid_court: 'ข้อมูลการจองไม่ถูกต้อง กรุณาเริ่มใหม่',
  invalid_hours: 'ข้อมูลการจองไม่ถูกต้อง กรุณาเริ่มใหม่',
  missing_supabase_env: 'ระบบยังไม่ได้ตั้งค่าฐานข้อมูล',
}
const errorText = (code: string) => ERROR_TEXT[code] ?? 'จองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'

// ─────────────── State ───────────────
type BookingState = { step: number, date: string, court: string | null, hours: number[] }
const INITIAL: BookingState = { step: 1, date: '', court: null, hours: [] }

export default function Page() {
  const [state, setState] = useState<BookingState>(INITIAL)
  const [days, setDays] = useState<Day[]>([])
  const [booked, setBooked] = useState<Booked>({}) // อยู่นอก state — ต้องรอดจากการรีเซ็ต
  const [booker, setBooker] = useState({ name: '', phone: '', note: '' })
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<{ ref: string, detail: string } | null>(null)
  const [nowHour, setNowHour] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const formRef = useRef<HTMLFormElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // อ่านเฉพาะช่องที่เต็ม — view นี้ไม่มีชื่อไม่มีเบอร์ ดู docs/adr/0001
  async function loadOccupancy(list: Day[]) {
    setLoading(true)
    setLoadError(false)
    try {
      const { data, error } = await db()
        .from('slot_occupancy')
        .select('court_id,booking_date,hour')
        .gte('booking_date', list[0].key)
        .lte('booking_date', list[list.length - 1].key)
      if (error) throw error
      setBooked((data ?? []).reduce<Booked>((acc, row) => {
        const key = `${row.booking_date}|${row.court_id}`
        return { ...acc, [key]: [...(acc[key] ?? []), row.hour] }
      }, {}))
    } catch {
      // ห้ามปล่อยให้ตารางว่างเปล่าดูเหมือน "ว่างทุกช่อง" ตอนต่อฐานข้อมูลไม่ได้
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  // วันที่อิงนาฬิกาเครื่องผู้ใช้ — ต้องคำนวณหลัง mount เท่านั้น
  // ถ้าคำนวณตอน render เซิร์ฟเวอร์จะใช้ timezone ของเซิร์ฟเวอร์ แล้ว hydration พัง
  useEffect(() => {
    const list = buildDays()
    setDays(list)
    setNowHour(bangkokHour())
    setState((s) => ({ ...s, date: list[0].key }))
    loadOccupancy(list)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งใจให้รันครั้งเดียวตอน mount
  }, [])

  // ─────────────── Self-check (เปิดด้วย ?selftest=1) ───────────────
  // ห้ามอ่าน state days/booked ที่นี่ — effect ในคอมมิตเดียวกันยังเห็นค่าก่อน setState
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('selftest') !== '1') return
    console.assert(formatRanges([10, 11, 12]) === '10:00 – 13:00', 'ชั่วโมงติดกันต้องรวมเป็นช่วงเดียว')
    console.assert(formatRanges([10, 14]) === '10:00 – 11:00, 14:00 – 15:00', 'ชั่วโมงไม่ติดกันต้องแยกช่วง')
    console.assert(formatRanges([12, 10, 11]) === '10:00 – 13:00', 'ต้องเรียงลำดับก่อนรวมช่วง')
    console.assert(totalPrice('C', [10, 11]) === 700, 'ราคารวม = ราคาคอร์ท × จำนวนชั่วโมง')
    console.assert(totalPrice('A', []) === 0, 'ยังไม่เลือกเวลา ราคาต้องเป็น 0')

    console.assert(buildDays()[0].key === dateKey(new Date()), 'วันแรกต้องเป็นวันนี้ตามเวลาท้องถิ่น')
    console.assert(bangkokHour() >= 0 && bangkokHour() <= 23, 'ชั่วโมงตามเวลาไทยต้องอยู่ในช่วง 0–23')
    console.info('selftest: เสร็จแล้ว — ถ้าไม่มี assertion ล้มเหลวด้านบน แปลว่าผ่าน')
  }, [])

  // ─────────────── นำทางระหว่างขั้น ───────────────
  // sync aria-invalid ให้ตรงกับสถานะที่ตาเห็น (:user-invalid ไม่ทำให้เอง)
  const syncAria = (input: Element) =>
    setInvalid((v) => ({ ...v, [input.id]: input.matches(':user-invalid') }))

  function goNext() {
    if (state.step === 1) return setState((s) => ({ ...s, step: 2 }))

    if (state.step === 2) {
      const form = formRef.current
      if (!form) return
      // ตรวจข้อมูลก่อนไปต่อเสมอ — ไม่ปล่อยค่าว่าง/รูปแบบผิดผ่าน
      if (!form.checkValidity()) {
        form.querySelectorAll('.field').forEach(syncAria)
        form.reportValidity()
        return
      }
      const fd = new FormData(form)
      setBooker({
        name: String(fd.get('name') ?? '').trim(),
        phone: String(fd.get('phone') ?? '').trim(),
        note: String(fd.get('note') ?? '').trim(),
      })
      return setState((s) => ({ ...s, step: 3 }))
    }

    void confirmBooking()
  }

  // เลขที่การจองสร้างจากฝั่ง DB และ DB เป็นคนปฏิเสธเมื่อช่องชนกัน (unique constraint)
  async function confirmBooking() {
    const day = days.find((d) => d.key === state.date)
    const court = courtOf(state.court)
    if (!day || !court || submitting) return

    setSubmitting(true)
    setFormError('')
    try {
      const { data: ref, error } = await db().rpc('create_booking', {
        p_court_id: state.court,
        p_booking_date: state.date,
        p_hours: state.hours,
        p_name: booker.name,
        p_phone: booker.phone,
        p_note: booker.note || null,
      })
      if (error) throw error
      await loadOccupancy(days)
      setDone({
        ref: String(ref),
        detail: `${court.name} · ${day.dayMonth} · ${formatRanges(state.hours)}`,
      })
      dialogRef.current?.showModal()
    } catch (e) {
      const code = (e as { message?: string })?.message ?? ''
      setFormError(errorText(code))
      // ช่องเพิ่งถูกคนอื่นจอง/เลยเวลา — ดึงตารางใหม่ให้ผู้ใช้เลือกต่อได้ทันที
      if (code === 'slot_taken' || code === 'slot_in_past') await loadOccupancy(days)
    } finally {
      setSubmitting(false)
    }
  }

  // ผูกกับ close เพื่อให้ปิดด้วยปุ่ม / Esc / คลิกนอกกล่อง ได้ผลเหมือนกันหมด
  // (ถ้าผูกไว้แค่ปุ่ม การกด Esc จะค้างอยู่ขั้น 3 แล้วกดยืนยันซ้ำได้)
  function handleDialogClose() {
    formRef.current?.reset()
    setBooker({ name: '', phone: '', note: '' })
    setInvalid({})
    setFormError('')
    setState({ ...INITIAL, date: days[0]?.key ?? '' })
  }

  // ─────────────── ค่าที่ derive จาก state ───────────────
  const ready = Boolean(state.date && state.court)
  const taken = ready ? bookedHours(booked, state.date, state.court) : []
  const isToday = days.length > 0 && state.date === days[0].key
  // ช่องที่เริ่มไปแล้วของวันนี้จองไม่ได้ — DB ปฏิเสธซ้ำอีกชั้นตอนยืนยัน
  const isPast = (hour: number) => isToday && nowHour >= 0 && hour <= nowHour
  const canProceed = Boolean(state.date && state.court && state.hours.length)
  const day = days.find((d) => d.key === state.date)
  const court = courtOf(state.court)

  const summaryRows: [string, string][] = day && court
    ? [
        ['วันที่', day.full],
        ['คอร์ท', `${court.name} (${court.surface})`],
        ['ช่วงเวลา', formatRanges(state.hours)],
        ['รวม', `${state.hours.length} ชั่วโมง`],
        ['ผู้จอง', booker.name],
        ['เบอร์โทร', booker.phone],
        ...(booker.note ? [['หมายเหตุ', booker.note] as [string, string]] : []),
      ]
    : []

  const fieldClass =
    'field w-full rounded-xl border border-line bg-panel-2 px-4 py-3 text-fg placeholder:text-mute-2 outline-none transition focus-visible:border-ball focus-visible:ring-2 focus-visible:ring-ball'

  return (
    <>
      <header className="bg-court court-lines text-white">
        <div className="mx-auto max-w-3xl px-4 py-7">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-ball text-court text-xl font-bold shadow-lg shadow-black/20">🎾</span>
            <div>
              <h1 className="text-xl font-bold leading-tight sm:text-2xl">กรีนสแมช เทนนิส คลับ</h1>
              <p className="text-sm text-white/70">จองคิวออนไลน์ · เปิดทุกวัน 09:00 – 21:00 น.</p>
            </div>
          </div>
        </div>
      </header>

      {/* แถบขั้นตอน */}
      <nav aria-label="ขั้นตอนการจอง" className="sticky top-0 z-10 border-b border-white/10 bg-ink/90 backdrop-blur">
        <ol className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 text-sm">
          {STEP_LABELS.map((label, i) => {
            const step = i + 1
            const active = step === state.step
            const past = step < state.step
            return (
              <li key={label} aria-current={active ? 'step' : 'false'} className="flex flex-1 items-center gap-2">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
                    active ? 'bg-ball text-court' : past ? 'bg-court-light text-white' : 'bg-panel-2 text-mute-2'
                  }`}
                >
                  {step}
                </span>
                <span className={`truncate transition ${active ? 'font-bold text-ball' : 'text-mute-2'}`}>{label}</span>
                {i < STEP_LABELS.length - 1 && <span className="hidden h-px flex-1 bg-line sm:block" />}
              </li>
            )
          })}
        </ol>
      </nav>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
        {/* ทั้ง 3 ขั้นต้องอยู่ใน DOM ตลอด — ใช้ hidden ไม่ใช่ conditional render
            ไม่งั้นค่าที่พิมพ์ในฟอร์มจะหายตอนกดย้อนกลับ และ formRef จะเป็น null
            (hidden ชนะ grid/flex ได้เพราะ preflight ของ Tailwind v4 ใส่ !important ให้) */}

        {/* ══════════ ขั้นที่ 1: เลือกวัน-เวลา ══════════ */}
        <section hidden={state.step !== 1}>
          <h2 className="mb-3 text-lg font-bold">1. เลือกวันที่</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {days.map((d) => {
              const on = d.key === state.date
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setState((s) => ({ ...s, date: d.key, hours: [] }))}
                  className={`shrink-0 rounded-xl border px-4 py-3 text-center transition focus-visible:ring-2 focus-visible:ring-ball ${
                    on ? 'border-ball bg-court text-white' : 'border-line bg-panel hover:border-ball/60'
                  }`}
                >
                  <span className="block text-xs opacity-70">{d.isToday ? 'วันนี้' : d.weekday}</span>
                  <span className="block font-bold whitespace-nowrap">{d.dayMonth}</span>
                </button>
              )
            })}
          </div>

          <h2 className="mt-7 mb-3 text-lg font-bold">2. เลือกคอร์ท</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {COURTS.map((c) => {
              const on = c.id === state.court
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setState((s) => ({ ...s, court: c.id, hours: [] }))}
                  className={`rounded-2xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-ball ${
                    on ? 'border-ball bg-ball/10 ring-2 ring-ball' : 'border-line bg-panel hover:border-ball/60'
                  }`}
                >
                  <span className="block font-bold">{c.name}</span>
                  <span className="block text-sm text-mute">{c.surface}</span>
                  <span className={`mt-2 block font-bold ${on ? 'text-ball' : ''}`}>
                    {baht(c.price)}
                    <span className="text-sm font-normal text-mute"> / ชม.</span>
                  </span>
                </button>
              )
            })}
          </div>

          <h2 className="mt-7 mb-1 text-lg font-bold">3. เลือกช่วงเวลา</h2>
          <p className="mb-3 text-sm text-mute">เลือกได้หลายช่อง ช่องละ 1 ชั่วโมง</p>
          <div
            hidden={ready && !loading && !loadError}
            className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-mute"
          >
            {!ready ? (
              'เลือกวันที่และคอร์ทก่อน เพื่อดูช่วงเวลาที่ว่าง'
            ) : loadError ? (
              <>
                <p className="text-danger">โหลดช่วงเวลาที่ว่างไม่สำเร็จ</p>
                <button
                  type="button"
                  onClick={() => loadOccupancy(days)}
                  className="mt-3 rounded-xl border border-line bg-panel-2 px-4 py-2 font-medium text-fg transition hover:border-ball/60 focus-visible:ring-2 focus-visible:ring-ball"
                >
                  ลองใหม่
                </button>
              </>
            ) : (
              'กำลังโหลดช่วงเวลาที่ว่าง…'
            )}
          </div>
          <div hidden={!ready || loading || loadError} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {HOURS.map((hour) => {
              const isTaken = taken.includes(hour)
              const past = !isTaken && isPast(hour)
              const on = state.hours.includes(hour)
              return (
                <button
                  key={hour}
                  type="button"
                  disabled={isTaken || past}
                  aria-pressed={on}
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      hours: s.hours.includes(hour) ? s.hours.filter((h) => h !== hour) : [...s.hours, hour],
                    }))
                  }
                  className={`rounded-xl border py-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-ball ${
                    isTaken
                      ? 'cursor-not-allowed border-line/60 bg-panel-2 text-mute-2'
                      : past
                        ? 'cursor-not-allowed border-dashed border-line/60 bg-panel text-mute-2'
                        : on
                          ? 'border-ball-dark bg-ball font-bold text-court'
                          : 'border-line bg-panel hover:border-ball/60'
                  }`}
                >
                  {isTaken || past ? (
                    <>
                      <span className="line-through">{hhmm(hour)}</span>
                      <span className="block text-xs">{isTaken ? 'เต็ม' : 'ผ่านไปแล้ว'}</span>
                    </>
                  ) : (
                    hhmm(hour)
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ══════════ ขั้นที่ 2: ข้อมูลผู้จอง ══════════ */}
        <section hidden={state.step !== 2}>
          <h2 className="mb-1 text-lg font-bold">ข้อมูลผู้จอง</h2>
          <p className="mb-5 text-sm text-mute">กรอกให้ครบเพื่อยืนยันคิว เราจะติดต่อกลับหากมีการเปลี่ยนแปลง</p>

          <form
            ref={formRef}
            noValidate
            onBlur={(e) => {
              const t = e.target as HTMLElement
              if (t.matches('.field')) syncAria(t)
            }}
            onInput={(e) => {
              const t = e.target as HTMLElement
              if (t.id in invalid) syncAria(t)
            }}
            onSubmit={(e) => {
              e.preventDefault()
              goNext()
            }}
            className="space-y-5 rounded-2xl bg-panel p-5 shadow-sm ring-1 ring-white/10"
          >
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
                ชื่อ-นามสกุล <span className="text-danger">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={2}
                autoComplete="name"
                aria-describedby="name-err"
                aria-invalid={invalid.name}
                placeholder="เช่น สมชาย ใจดี"
                className={fieldClass}
              />
              <p id="name-err" className="err mt-1.5 text-sm text-danger">
                กรุณากรอกชื่อ-นามสกุล อย่างน้อย 2 ตัวอักษร
              </p>
            </div>

            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
                เบอร์โทรศัพท์ <span className="text-danger">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                pattern="0[0-9]{9}"
                inputMode="numeric"
                maxLength={10}
                autoComplete="tel"
                aria-describedby="phone-err"
                aria-invalid={invalid.phone}
                placeholder="0812345678"
                title="เบอร์โทรศัพท์ 10 หลัก ขึ้นต้นด้วย 0"
                className={fieldClass}
              />
              <p id="phone-err" className="err mt-1.5 text-sm text-danger">
                กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0 (เช่น 0812345678)
              </p>
            </div>

            <div>
              <label htmlFor="note" className="mb-1.5 block text-sm font-medium">
                หมายเหตุ <span className="text-mute-2">(ไม่บังคับ)</span>
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                maxLength={200}
                placeholder="เช่น ขอยืมไม้แร็กเกต 2 อัน"
                className="w-full resize-none rounded-xl border border-line bg-panel-2 px-4 py-3 text-fg placeholder:text-mute-2 outline-none transition focus-visible:border-ball focus-visible:ring-2 focus-visible:ring-ball"
              />
            </div>
          </form>
        </section>

        {/* ══════════ ขั้นที่ 3: ยืนยันการจอง ══════════ */}
        <section hidden={state.step !== 3}>
          <h2 className="mb-1 text-lg font-bold">ตรวจสอบและยืนยัน</h2>
          <p className="mb-5 text-sm text-mute">โปรดตรวจสอบรายละเอียดก่อนกดยืนยัน</p>

          <div className="overflow-hidden rounded-2xl bg-panel shadow-sm ring-1 ring-white/10">
            <dl className="divide-y divide-white/10">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="flex gap-4 px-5 py-3">
                  <dt className="w-24 shrink-0 text-sm text-mute">{label}</dt>
                  <dd className="flex-1 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {formError && (
              <p role="alert" className="border-t border-white/10 bg-panel-2 px-5 py-3 text-sm text-danger">
                {formError}
              </p>
            )}
            <div className="flex items-end justify-between gap-4 bg-court px-5 py-4 text-white">
              <div>
                <p className="text-sm text-white/70">รวมทั้งสิ้น</p>
                <p className="text-sm text-white/70">
                  {court ? `${baht(court.price)} × ${state.hours.length} ชม.` : ''}
                </p>
              </div>
              <p className="text-3xl font-extrabold tracking-tight text-ball">{baht(totalPrice(state.court, state.hours))}</p>
            </div>
          </div>
        </section>
      </main>

      {/* แถบสรุป + ปุ่มนำทาง (ติดล่างจอ) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-mute">
            {state.step !== 1
              ? ''
              : canProceed
                ? `เลือกแล้ว ${state.hours.length} ชม. · ${baht(totalPrice(state.court, state.hours))}`
                : 'เลือกวัน คอร์ท และช่วงเวลา'}
          </p>
          <button
            type="button"
            hidden={state.step === 1}
            onClick={() => setState((s) => ({ ...s, step: s.step - 1 }))}
            className="rounded-xl px-4 py-3 font-medium text-mute transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ball"
          >
            ย้อนกลับ
          </button>
          <button
            type="button"
            disabled={(state.step === 1 && !canProceed) || submitting}
            onClick={goNext}
            className="rounded-xl bg-ball px-6 py-3 font-bold text-court shadow-sm transition hover:bg-ball-dark focus-visible:ring-2 focus-visible:ring-ball focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:bg-panel-2 disabled:text-mute-2 disabled:shadow-none"
          >
            {submitting ? 'กำลังจอง…' : state.step === 3 ? 'ยืนยันการจอง' : 'ถัดไป'}
          </button>
        </div>
      </div>

      {/* ป๊อปอัพยืนยันสำเร็จ */}
      <dialog
        ref={dialogRef}
        closedby="any"
        onClose={handleDialogClose}
        className="m-auto w-[min(24rem,90vw)] rounded-2xl bg-panel p-0 text-fg ring-1 ring-white/10 backdrop:bg-ink/85"
      >
        <div className="p-7 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-ball text-3xl">✓</div>
          <h2 className="mt-4 text-xl font-bold">จองสำเร็จแล้ว!</h2>
          <p className="mt-1 text-sm text-mute">เจ้าหน้าที่จะโทรยืนยันก่อนถึงเวลาจอง</p>
          <p className="mt-4 text-sm text-mute">เลขที่การจอง</p>
          <p className="text-2xl font-bold tracking-wider text-ball">{done?.ref}</p>
          <p className="mt-3 text-sm text-mute">{done?.detail}</p>
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            className="mt-6 w-full rounded-xl bg-court px-4 py-3 font-bold text-white transition hover:bg-court-light focus-visible:ring-2 focus-visible:ring-ball"
          >
            จองอีกครั้ง
          </button>
        </div>
      </dialog>
    </>
  )
}
