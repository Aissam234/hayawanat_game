# Username/password authentication

The frontend requires an account to play. Register with a username (3–50 characters after trimming) and a password (at least 8 characters, at most 72 UTF-8 bytes). Usernames are case-sensitive. Existing shorter-password accounts can still log in. Password confirmation is required in the registration form.

Passwords are salted and hashed with bcrypt. Sessions expire after seven days. Each round won adds one permanent point to the player's account in the existing PostgreSQL database. Existing guest API behavior remains for compatibility, but the frontend no longer offers guest play. Account-owned participants require a matching session token for protected HTTP and WebSocket actions.

Google sign-in and its endpoint are removed. Historic migrations and unused Google identity columns remain so previously deployed databases can upgrade safely without losing data. Existing Google-only accounts have no password and cannot sign in through the password form; they are not automatically merged with new accounts.

## Render (existing free service)

- Keep the existing Neon `DATABASE_URL`.
- Set a strong private `SECRET_KEY` of at least 32 characters; retain an existing strong value. Changing it signs out existing sessions.
- Set `ALLOWED_ORIGINS=https://hayawanat-game.vercel.app` (include other intended origins as a comma-separated list).
- Keep the Docker startup command that runs `alembic upgrade head` before Uvicorn. No paid release command or web shell is required.
- `GOOGLE_CLIENT_ID` is no longer used and may be removed.

## Vercel (existing Hobby project)

- Keep `VITE_API_URL` set to the Render HTTPS URL.
- Keep `VITE_WS_URL` set to the corresponding WSS URL.
- `VITE_GOOGLE_CLIENT_ID` is no longer used and may be removed. No Google Console configuration is needed.
- Deploy the new frontend and backend together, then test registration, logout, login, a round win, and score persistence after signing in again.

No new paid service is introduced. Existing free-tier quotas and cold starts still apply.

## Limits

Password recovery/change is not implemented. The registration screen states this so players can save their password. Signing out clears the local token; other devices remain signed in until token expiry. Tokens are stored in browser local storage. The bounded process-local login limiter resets on restart. This is not a competitive anti-cheat system.

## Local verification

Tests must use a disposable database with `HAYAWANAT_TEST_DATABASE=1`. The authentication fixture cleans up its accounts and rooms. Run `pytest tests -q` for the backend and `npm run typecheck` / `npm run build` for the frontend. The browser regression uses a dedicated frontend on port 15173 connected to a disposable backend on 18080.
