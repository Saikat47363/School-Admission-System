# School Admission System

.NET 8 + PostgreSQL backend and a React 18 (Vite) frontend. Only Docker is needed.

## Run

```bash
docker compose up --build
```

- **App (frontend): http://localhost:3000**
- Backend API: http://localhost:8080
- Hold duration: 600 s by default. Change it with
  `HOLD_DURATION_SECONDS=30 docker compose up --build`
- Data is kept in a Docker volume, so `docker compose down` then `up` keeps it.
  (`docker compose down -v` wipes it.)

## Using the app

1. Open http://localhost:3000.
2. **Class তৈরি (Admin)** tab: create a class (name + seats).
3. Type a 17-digit birth registration number in the box at the top (it is remembered after a refresh).
4. **Class তালিকা**: press "আবেদন করুন" to hold a seat, then "ভর্তি ফি দিন" before the timer ends.
5. **আমার আবেদন** lists all applications of that student.

Seat counts refresh every few seconds and an expired application flips to EXPIRED on its own.

## Tests (backend)

```bash
docker compose run --rm backend-tests
```

This starts PostgreSQL and runs the xUnit tests against it. They include a concurrency test
(100 applicants for 10 seats -> exactly 10 succeed) and a parallel same-student test.

## Configuration (environment variables)

| Variable | Meaning | Default |
|---|---|---|
| `DB_CONNECTION` | PostgreSQL connection string | local Postgres |
| `HOLD_DURATION_SECONDS` | How long a seat stays held | `600` |
| `API_URL` (frontend container) | Backend URL as seen by the browser | `http://localhost:8080` |
| `VITE_API_URL` (only for `npm run dev`) | Same, for local development | `http://localhost:8080` |

## Frontend without Docker (optional)

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

See `ASSUMPTIONS.md` for design decisions.
