# Google accounts and permanent scores

Google sign-in is optional. Guests can create rooms, join and play. Signed-in players earn one permanent point for each round won. Points are stored in the existing PostgreSQL/Neon database and follow the same Google account across rooms and devices. Previous guest points are not transferred. Existing password accounts are retained; accounts are not merged by display name or email.

## Local setup

The supplied public Web client ID has already been set in the ignored root `.env` as `GOOGLE_CLIENT_ID` and ignored `frontend/.env.local` as `VITE_GOOGLE_CLIENT_ID`. These must match. The backend also requires a strong `SECRET_KEY` of at least 32 characters.

In Google Cloud Console, open the OAuth Web client and add these **Authorized JavaScript origins**:

- `http://localhost`
- `http://localhost:5173`
- Your exact production Vercel HTTPS origin, without a path or trailing slash.

Configure the Google consent screen. If Google limits this project to test users, add the Google accounts used for testing. This integration uses the Google Identity Services popup and JavaScript credential callback, so it does not require an application OAuth redirect route or client secret. Do not put a client secret in Vercel frontend variables.

Open `http://localhost:5173`, click the Arabic sign-in button and choose a Google account. Check that your name and score appear. Win a round, return home, and check that the total increases once. Sign out and sign back in to check persistence. Test guest play in a private browser window. Actual Google account sign-in requires this manual check; automated tests use signed test credentials, not a real Google account.

For Docker: `docker compose up --build`. For a frontend running directly on Windows, run `npm run dev -- --host` in `frontend` with the backend available on port 8000. Vite proxies API and WebSocket requests to localhost; Docker supplies its internal proxy targets. Only one frontend can occupy port 5173 at a time.

iPhone microphone use requires a trusted HTTPS origin. Plain LAN HTTP is insufficient; Google sign-in also requires a Google-authorized origin. The deployed Vercel HTTPS URL is the simplest cross-device test after deployment.

## Render: existing backend service

Keep the existing free service and Neon database. Set:

- `GOOGLE_CLIENT_ID`: the same public Google Web client ID.
- `SECRET_KEY`: a long random private value; retain an existing strong value. Changing it signs everyone out but does not delete scores.
- Keep `DATABASE_URL` pointed to the existing Neon database.
- Ensure `ALLOWED_ORIGINS` includes the exact Vercel HTTPS origin.

Keep the existing startup command that runs `alembic upgrade head` before Uvicorn. The migration chain adds users/participant account links and then Google identities (`dd6b0f5693b7` followed by `0006_google_accounts`). Do not reset or delete the database. Backend dependencies now include PyJWT's cryptographic verification support.

## Vercel: existing frontend project

Add `VITE_GOOGLE_CLIENT_ID` with the same public client ID in the relevant environment (Production, and Preview only if its origin is authorized with Google). Keep the existing `VITE_API_URL` HTTPS Render URL and `VITE_WS_URL` WSS Render URL. Redeploy after changing Vite environment variables because they are embedded at build time.

The checked-in `vercel.json` supplies `Cross-Origin-Opener-Policy: same-origin-allow-popups` for the Google popup. No additional service is required.

## Cost and security behavior

This implementation adds no paid authentication service, Redis instance, or media storage. It uses Google Identity Services with the existing backend and database; existing provider free-tier quotas and Render sleep/cold starts still apply.

The backend validates Google's signature, issuer, audience, expiration and stable subject. App sessions last seven days. Account-owned room actions require both the room session secret and a matching account token, including WebSockets. Winner updates are transactional and repeated completed-round submissions cannot award points again.

App tokens are stored in browser local storage. Signing out clears the local session; it does not revoke tokens already copied to another device. No Google access token or refresh token is stored. The process-local login limiter resets on backend restart.

## Verification

- Backend regression suite: 50 tests, covering token validation, guest play, account protection and score persistence.
- Frontend TypeScript check and production build.
- Real Google button rendered locally with the supplied client ID; guest option dismissed successfully; no uncaught browser errors.
- Microphone browser regression: silence, normal/high input, stop/preview, unmount cleanup, analyser failure and automatic stop passed at mobile viewport width.
- A real Google account login and the deployed iPhone flow still require manual verification.

Local Docker package downloading hit a DNS failure. Dependencies were installed into the cached local image using downloaded wheels for testing; a clean normal Docker build has not been verified in this environment.

Before testing online, configure the Render and Vercel variables above and register the exact production origin with Google. A Git push alone does not complete Google Console configuration.

References: [Google setup and origins](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [server token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
