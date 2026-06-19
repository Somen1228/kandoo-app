# Kandoo API

The API verifies Firebase ID tokens and stores one revisioned workspace per
account in PostgreSQL.

## Local setup

1. Create a PostgreSQL database named `kandoo`.
2. Copy `.env.example` to `.env` and set the database values.
3. Download a Firebase Admin service account JSON and save it as
   `server/firebase-service-account.json`.
4. Run `npm install` in `server/`, then run `npm run dev`.

The service exposes:

- `GET /api/health`
- `POST /api/auth/session`
- `GET /api/workspace`
- `PUT /api/workspace`

Workspace writes carry a `baseRevision`. A stale revision returns HTTP `409`
instead of overwriting changes from another device.

