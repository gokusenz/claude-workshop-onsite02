# CONTEXT

Glossary for the tennis court booking system. Terms only — no implementation details.

## Slot

One court, on one date, for one clock hour. `คอร์ท A · 20 ส.ค. · 15:00` is one Slot.
A Slot is the unit of availability: it is either free or taken, never partially either.
Slots exist conceptually for every court × date × opening hour; only *taken* ones are recorded.

## Booking

One person reserving one or more **contiguous or non-contiguous Slots** on a single court and
a single date, in one action. A Booking is identified by its **Booking Reference**.

Note the asymmetry that caused confusion early on: the user experiences *one* Booking
("จอง 13:00–15:00"), but that is *two* Slots. Anything counting Slots is not counting Bookings.

## Booking Reference

The human-quotable identifier of a Booking, shown to the customer after confirming
(format `TN-XXXXXX`). Shared by every Slot in the same Booking — it is what makes the Slots
one Booking rather than several.

## Occupancy

The set of taken Slots, stripped of who took them. Occupancy is what the booking screen needs
to grey out unavailable hours; it deliberately carries no customer information.

## Past Slot

A Slot on today's date whose hour has already begun. Distinct from a taken Slot: nobody booked
it, but it can no longer be booked. The UI must distinguish the two — "ผ่านไปแล้ว" vs "เต็ม".

## Booking Horizon

How far ahead Bookings are accepted: today plus the next 6 days (7 days total). Dates outside
the horizon are not offered and are refused if submitted.

## Court

A physical court, identified by a single letter (`A`, `B`, `C`), with a surface description and
an hourly price. Courts are currently fixed in application code, not stored data.

## Opening Hours

The hours a Court can be booked for: 09:00 through 20:00 inclusive, each a one-hour Slot
(the club closes at 21:00, so 20:00 is the last bookable Slot).
