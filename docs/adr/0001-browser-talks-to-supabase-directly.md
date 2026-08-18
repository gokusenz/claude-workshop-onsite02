# 1. Browser talks to Supabase directly, PII protected by grants not by a server

Date: 2026-08-18

## Status

Accepted

## Context

The booking app is deployed on Vercel with Supabase as its database. There is **no
authentication** — anyone can open the page and book. Two ways to reach the database were
considered:

**(a) Direct from the browser** with the Supabase publishable key, access controlled by
Row Level Security. No Next.js server code.

**(b) Through Next.js Route Handlers** holding the secret key server-side. The browser never
touches Supabase.

The consequential difference is customer PII. Bookings carry a name and a phone number. With
no auth, an RLS policy permissive enough to let the booking screen read availability is also
permissive enough to let anyone open DevTools and dump every customer's name and phone.

Option (b) removes that risk structurally but adds a server layer to a project whose whole
point, so far, is being small.

## Decision

**(a) — direct from the browser** — with the PII exposure closed at the database rather than
by adding a server:

- `booked_slots` has RLS enabled and **no policies**, and all privileges are revoked from the
  `anon` role. The browser cannot read or write the table at all.
- Availability is read through a view, `slot_occupancy`, which projects only
  `(court_id, booking_date, hour)`. It is `security_invoker = false`, so it runs as its owner
  and bypasses the base table's RLS. `anon` is granted `SELECT` on the view only.
- Bookings are written through one `security definer` function, `create_booking(...)`, which
  validates its inputs and returns only the new booking reference. `anon` is granted
  `EXECUTE` on that function only.

So the browser can learn *which hours are taken* and can *create* a booking, and has no path
to read a name or a phone number.

## Consequences

- No Next.js server code, no secret key in the deployment. The app stays a static frontend
  plus a database.
- **Every input validation that matters must live inside `create_booking`.** The client is
  fully attacker-controlled; its `checkValidity()` is a UX affordance, not a control. Past-slot
  rejection, booking-horizon limits, court validity, and phone format are all re-checked in SQL.
- **The database schema is the API contract.** Renaming a column or changing the function
  signature is a breaking change for deployed clients, with no server layer to adapt in.
- **Anyone can create bookings at will.** With no auth and (by decision) no rate limiting, the
  publishable key is a public write endpoint for `create_booking`. Accepted for a workshop
  demo; it is the first thing to fix if this ever takes real money.
- Adding a feature that needs to *read* customer data (an admin screen, a "find my booking"
  page) cannot reuse this path — it needs option (b) for that route, or real auth. That is a
  known future fork, not a regression.
