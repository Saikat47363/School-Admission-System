# Assumptions

The brief leaves several things open. This is what I decided and why.

## Seats and concurrency
- **Locking:** every operation that changes seat usage first locks the class row
  (`SELECT ... FOR UPDATE`) inside a transaction. PostgreSQL then handles requests for one
  class one at a time, so `held + confirmed` can never pass `totalSeats`. Different classes
  do not block each other.
- **Why this also works with two backend processes (bonus):** the lock lives in the database,
  not in app memory, so any number of processes sharing one database get the same guarantee.
  All time comparisons use the database clock (`now()`), so processes cannot disagree about expiry.
- **Expiry:** a `HELD` row whose `expires_at` has passed is treated as `EXPIRED` everywhere
  (seat counts, `GET /holds/{id}`, `/me/holds`) without any API call. A background job also
  rewrites such rows to `EXPIRED` every 2 seconds for tidiness only.

## Rules
- **One application per student per class:** a second `POST .../holds` while the student has a
  `HELD` or `CONFIRMED` application in that class returns `409`. A student whose earlier
  application `EXPIRED` or was `CANCELLED` may apply again. A partial unique index enforces this too.
- **Duplicate confirm:** confirming an already `CONFIRMED` hold returns `200` and changes nothing.
- **Confirm on an expired / cancelled hold:** `409` with a readable message.
- **Confirm or cancel someone else's hold:** `403`.
- **Cancel:** allowed only for `HELD`. Cancelling an already `CANCELLED` hold returns `204` (idempotent).
  Cancelling a `CONFIRMED` admission returns `409` (the brief only talks about cancelling an application).
  Cancelling an `EXPIRED` hold returns `409`.
- **Confirm = payment succeeded:** no payment gateway, as the brief says.

## API details
- `X-Student-Id` must be exactly 17 digits, otherwise `400`. It is required on the endpoints that
  act for a student (apply, confirm, cancel, `/me/holds`). `GET /classes`, `GET /classes/{id}`
  and `GET /holds/{id}` do not need it.
- Errors are JSON: `{ "error": "readable message" }`.
- IDs are short random strings (`c_xxxxxxxx`, `h_xxxxxxxxxxxx`).
- `totalSeats` must be 1 to 100000; class name is required (max 200 chars). Duplicate class
  names are allowed.
- `GET /holds/{id}` does not require the header (the brief lists it only on the other endpoints).
- Responses include extra fields (`studentId`, `availableSeats`, `className`) but never remove or rename the documented ones.
- CORS is open to any origin so the React app can call the API from another port.

## Frontend
- **Student identity:** the 17-digit number typed at the top is the identity (no login). It is kept in
  `localStorage` so a refresh or a reopened browser still shows the student's applications.
  Only exactly 17 digits is accepted; other input is rejected before any request is sent.
- **Live updates:** seat counts poll every 3 s, an open application polls every 2 s. A countdown runs
  locally from `expiresAt`; when it reaches zero the screen shows EXPIRED, disables "ভর্তি ফি দিন",
  and immediately re-asks the server. (If the browser clock is badly wrong the countdown can be off;
  the server's answer still wins on the next poll.)
- **Backend URL** is read at container start from `API_URL` (written into `config.js`), so it can change
  without rebuilding the image. The browser calls the backend directly, so `API_URL` must be a URL the
  *browser* can reach (default `http://localhost:8080`).
- **Errors** are shown as readable Bangla messages in a banner; if polling fails the last data stays on
  screen with a "retrying" notice instead of a blank page.
- No automated frontend tests (the optional bonus was skipped).
