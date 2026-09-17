# AmethystPlus API

Requires Node.js 24+. Uses built-in SQLite and crypto; no dependency install is needed.

## Start locally

Provision the single administrator before allowing sign-ups. Supply your own email and a password of 12–128 characters. Do not commit credentials.

```sh
cd backend
ADMIN_EMAIL='your-admin@example.com' ADMIN_PASSWORD='your-unique-long-password' npm start
```

The administrator is created only if none exists. Later starts can use `npm start` with no credentials. Supplying credentials for an existing administrator does not reset its password. Public sign-up always creates readers, even if the request includes a role. Owner names are assignment labels; assigning a ticket does not create an account or send a notification.

Alternatively, save `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`, then run `npm start` from `backend`. Both `npm start` and `npm run dev` automatically load this ignored file. Use normal variable names and email addresses, without Markdown backslashes. Restart the backend after changing `.env`; existing admin passwords are not reset automatically.

In a second terminal:

```sh
cd frontend/amethyst-ep
npm run dev
```

Open http://localhost:5173, choose a circle, and sign in. Tickets opens the editable action register, Roadmap shows the executable phase timeline, and Team groups tickets by owner. Reader accounts can inspect all three views but cannot mutate tickets or the roadmap.

Data persists in `backend/data/amethyst.sqlite`. Back up this directory. New workspaces start with no tickets or roadmap entries. Records are created by the administrator.

## Configuration

- `PORT`: API port, default 3001.
- `DATABASE_PATH`: optional SQLite location.
- `APP_ORIGIN`: exact browser origin, default `http://localhost:5173`. Use `http://localhost:4173` for Vite preview.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: initial administrator provisioning.
- `NODE_ENV=production`: enables secure session cookies; requires HTTPS.

For deployment, serve the frontend and proxy `/api` to this server under one HTTPS origin, set `APP_ORIGIN` accordingly, and run one API process against the database. The API binds to loopback. Authentication uses salted scrypt password hashes, hashed session tokens, HttpOnly SameSite cookies, eight-hour sessions, and server-side role checks. Authentication endpoints have an in-memory request limit. Sign-ups do not verify email, and password recovery is not yet implemented. This implementation is intended for a single workspace; all registered readers can see all tickets.

```sh
npm test
```

Tests use a temporary database and check signup privilege enforcement, reader write denial, admin edits, validation, cross-origin rejection, concurrent edit conflicts, logout, and persistence after restart.

## Roadmap

Startup creates an empty `roadmap` table if needed. No sample data is inserted. Existing accounts and tickets remain intact. Restart the backend after this upgrade.

- `GET /api/roadmap`: authenticated read access.
- `POST /api/roadmap`: admin-only workstream creation.
- `PATCH /api/roadmap/:id`: admin-only edits with the current `version`.
- `POST /api/roadmap/:id/execute`: admin-only `{ action: 'start' | 'complete' | 'reopen', version }`.

Each executed workstream links to a single ticket. Roadmap and ticket changes are committed together in SQLite transactions. Start uses the end of the target month as the ticket due date. Complete/reopen synchronizes statuses; linked ticket edits synchronize owner and status back to the roadmap. Roadmap updates also synchronize title and target due date to the ticket, but preserve ticket notes. Tests cover duplicate execution, leap-year due dates, permissions, conflicting edits, and persisted links.

## Team directory

Startup creates an empty `team` table without changing existing data. Authenticated users can read `GET /api/team`; only the admin can `POST /api/team` or `PATCH /api/team/:id`. Profiles contain name, position, email, and an optional uploaded PNG/JPEG/WebP image (maximum 512 KB), stored in SQLite. Updates require the current version. Email and display name must be unique within the directory.

Changing a person's name updates matching ticket and roadmap owner labels in one transaction. Team profiles are separate from login accounts and do not send invitations or grant access.
