# Voice questions V1

Implemented and locally tested on 2026-09-21. No commit, push, or cloud deployment was performed. No new production dependencies, paid APIs, storage services, or audio processing services are required.

## Player experience

The active player can choose **✍️ سؤال كتابي** or **🎤 سؤال صوتي**. Voice recording stops automatically at 12 seconds. The player must preview/send explicitly; stopping never sends. Delete/re-record, recording progress, sending feedback and Arabic error messages are included.

The opponent and connected audience receive a replayable audio player. Only the opponent can answer. Yes/no count and switch turns; invalid remains visible in history, does not count, and keeps the asker’s turn. The same limit applies to text and voice together.

## Files changed

Backend:

- `backend/app/models/models.py`: nullable text, question type, duration and idempotency metadata.
- `backend/app/schemas/schemas.py`: question response metadata.
- `backend/app/services/round_service.py`: shared text/audio validation; round row lock; pending-question/deadline/active-member checks; safe repeat-answer handling.
- `backend/app/api/questions.py`: shared metadata serializer, active membership, authoritative question count in answer events.
- `backend/app/api/rounds.py`: history metadata; rematch uses normal start flow and timer registration; excludes inactive players.
- `backend/app/websocket/audio.py` (new): MIME, base64, size, duration and lightweight container validation.
- `backend/app/websocket/handlers.py`: authenticated socket handshake, voice relay and acknowledgments, reconnect snapshots and timer restoration.
- `backend/app/websocket/manager.py`: socket replacement cleanup and bounded send timeout.
- `backend/app/websocket/serializers.py`: added question metadata serializer. Existing secret-animal serializers remain unchanged.
- `backend/app/game/timer.py`: replacing a timer cannot accidentally unregister its replacement.
- `backend/migrations/versions/0004_voice_questions.py` (new): metadata-only migration.
- `backend/Dockerfile`: one worker; explicit WebSocket transport limits.
- `backend/tests/test_voice.py` (new): validation, PostgreSQL integration, concurrency, real transport and regression checks.
- `backend/tests/check_voice_migration.py` (new): guarded, standalone migration compatibility check.

Frontend:

- `frontend/src/components/game/VoiceQuestionRecorder.tsx` (new): recorder and preview lifecycle.
- `frontend/src/components/game/QuestionAudio.tsx` (new): playback/unavailable fallback.
- `frontend/src/services/voiceAudio.ts` (new): bounded transient object-URL cache and encoding helpers.
- `frontend/src/pages/GamePage.tsx`: question modes, playback, deadline and recorder availability.
- `frontend/src/components/game/QuestionHistory.tsx`: audio questions and invalid-question history.
- `frontend/src/services/websocket.ts`: authentication, acknowledged voice sends, timeout/disconnect handling.
- `frontend/src/store/gameStore.ts`: metadata-only state, transient playback integration, question counts and finished-round recovery.
- `frontend/src/types/game.ts`: audio metadata and acknowledgment types.
- `frontend/tests/voice.e2e.cjs` (new): three-client browser regression script with synthetic microphone input.

Other:

- `docker-compose.yml`: matching local WebSocket limits.
- `docs/VOICE_QUESTIONS.md` (this file).

The pre-existing untracked `backend/test_api.py` was not changed.

## Migration and persistence

Revision **0004_voice_questions**, following `0003_features_v2`:

- `question_type`: text/audio; existing rows default to text.
- `question_text`: nullable for audio questions.
- `audio_duration_ms`: optional integer, 1–12000 for audio.
- `client_request_id`: optional unique UUID to prevent duplicate voice submissions after uncertain delivery.
- Database check constraint enforces consistent text/audio metadata.

No audio bytes, base64, files, MIME payload or object URLs enter PostgreSQL. Existing asker/answer/validity/timestamps remain the normal question record. A downgrade preserves audio question history as a readable text label; it cannot preserve an audio type that the old schema does not support.

## WebSocket protocol

The existing `/ws/{room_code}/{participant_id}` connection is reused. Its first frame must now be:

```json
{"type":"authenticate","guest_uuid":"existing-session-uuid"}
```

The server checks room, active participant and session ownership before registering the connection or sending role-aware state. Public participant IDs alone no longer authorize a socket. Authentication has a 10-second timeout and a 512-byte application limit. Credentials are not placed in the socket URL.

Client upload:

```json
{
  "type": "voice_question",
  "data": {
    "round_id": "current-round-uuid",
    "request_id": "unique-request-uuid",
    "audio_base64": "...",
    "mime_type": "audio/webm;codecs=opus",
    "duration_ms": 5000
  }
}
```

Server broadcasts the existing **question_submitted** event with ordinary question metadata, `round_id`, and a transient `audio` object containing `audio_base64`/`mime_type`. It sends **voice_question_accepted** (`request_id`, `question_id`) or **voice_question_error** (`request_id`, Arabic `message`) to the sender. Answers still use the existing REST endpoint and **answer_submitted** event; the latter now includes `question_count`.

A retry reuses its request UUID. Already-created questions are acknowledged without another record or audio broadcast. After a delivery timeout the client reconnects to recover authoritative metadata; it never automatically resends media.

## Bounds, security and lifecycle

- Maximum decoded clip: **262144 bytes (256 KiB)**.
- Maximum complete incoming WebSocket message: **393216 bytes (384 KiB)**.
- Uvicorn uses `--ws websockets --ws-max-size 393216 --ws-max-queue 4 --ws-per-message-deflate false`. Application validation also checks message length before JSON parsing. These transport settings prevent the default much larger message/queue allocation. [Uvicorn settings](https://www.uvicorn.org/settings/)
- At most one upload attempt per second per connection; excess attempts close the socket.
- Preferred encoding: WebM/Opus at a requested 64 kbps. Supported fallbacks are Opus/Ogg and AAC/MP4. The browser selects only supported formats, and the server enforces a matching MIME allowlist.
- The server independently validates base64, actual decoded byte length and basic container signatures. It checks current round ID, active room membership, player role, current turn, pending question, deadline and shared question count.
- Client-reported duration is **not** proof of the encoded audio’s real duration. V1 deliberately does not decode/transcode audio on the server. The hard byte limit and message/rate bounds protect resources independently; a maliciously encoded longer clip cannot be ruled out by duration metadata alone.
- Shared row locking prevents simultaneous text/audio actions from creating two pending questions. Duplicate answers cannot count twice.
- The server only holds audio during validation/broadcast; it is never retained for replay or written to application logs, database rows or the filesystem.
- Client playback cache: at most **32 clips / 8 MiB**. Eviction revokes object URLs. Clearing the round, leaving the game page, resetting the session or disconnecting clears cached recordings.
- Recording cleanup stops tracks/recorder, removes listeners, clears timers and revokes preview URLs. Permission responses arriving after unmount are discarded and their tracks stopped. Connection loss, turn/round changes, player removal, backgrounding while recording and deadline expiry discard unsent recordings.
- After reconnect/refresh, question metadata and answers return, but playback displays: **التسجيل غير متوفر بعد إعادة الاتصال أو تفريغ الذاكرة**. Late joiners also cannot replay earlier recordings.
- Browser codec/playback failures degrade to Arabic feedback; written questions remain available. Microphone access needs HTTPS or localhost. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)

## Local verification results

- TypeScript `tsc --noEmit`: passed.
- Vite production build: passed; JS approximately 359.75 kB / 113.53 kB gzip.
- Backend: **37 tests passed**, including existing tests. Only existing Pydantic/pytest-asyncio deprecation warnings remain.
- Chrome: **22 browser checks passed**.
- Microsoft Edge: **22 browser checks passed**.
- Fresh database migration, upgrade with an existing Arabic text question, audio metadata insert, downgrade and re-upgrade: passed. History retained.
- Uvicorn transport independently rejected an oversized frame with close code **1009**.
- Secret-animal regression checks: players receive only the opponent animal; audience receives the existing role-appropriate view. The serializer functions themselves were not modified.

Browser checks used three isolated sessions, actual MediaRecorder output from a synthetic microphone, HTTPS/WSS, actual opponent/audience audio decode/playback, and 390×844 mobile viewport. They covered five-second recording, preview without sending, delivery/playback, yes/no/invalid, mixed five-question limit, 12-second auto-stop, unavailable history, recording/sending disconnects, deletion/revocation, backend rejection, turn changes, server timer expiry, removal and rematch. Unsupported/missing/denied-device branches used controlled browser API failures. No uncaught page errors occurred.

Physical Android/iOS microphones, Safari codecs, device audio routing and real network conditions have not been tested. These results do not guarantee deployment settings or every browser/device combination.

## Local testing instructions

For normal local development, start the existing Compose setup; backend startup runs the migration:

```sh
docker compose up -d --build
```

Open the frontend on **localhost**, or use a trusted HTTPS address for phone testing. Plain HTTP on a LAN IP does not enable microphone access.

For backend integration tests, point `DATABASE_URL` at a **disposable PostgreSQL database**, install the existing backend requirements, and run from `backend`:

```sh
alembic upgrade head
HAYAWANAT_TEST_DATABASE=1 pytest tests -q
```

To include the actual Uvicorn transport test, start this backend with the WebSocket flags above and also set `HAYAWANAT_WS_TEST_URL=ws://127.0.0.1:8000`. Without the opt-ins, database/transport tests skip rather than touching a normal database. The standalone migration check requires a separate **empty** database and `HAYAWANAT_MIGRATION_TEST=1`:

```sh
python tests/check_voice_migration.py
```

For browser tests, install Playwright as a local test tool (not a production dependency), start the test frontend/backend, and run:

```sh
npm install --no-save --package-lock=false playwright
node tests/voice.e2e.cjs
```

Configure `VOICE_FRONTEND_URL`, `VOICE_API_URL`, `CHROME_PATH`, and optionally `VOICE_REPORT` / `VOICE_SCREENSHOT_DIR`. Defaults expect the temporary local HTTPS/WSS test proxy on ports 18443/18444 and the isolated API on 18080. Set your frontend build-time API/WS URLs to match your own test servers. `VOICE_EXPIRE_COMMAND=1` is only for the specific disposable Docker fixture named `hayawanat-voice-api`; it shortens the test round to four seconds and must not target a real database. The browser script creates test rooms and removes one test participant, so use a test backend.

Manual check on a real phone: create a room with two players and an audience member; record/preview/send; replay on the other devices; answer yes/no/invalid; refresh; start another timed round and let the timer expire while recording. Check microphone quality and browser permission prompts.

## Render, Vercel and Neon rollout — after approval

**Render:** keep the existing free web service and Neon connection. No new environment variables, disk, service or paid feature is needed. The new Dockerfile CMD already runs migration plus the correctly bounded single-worker server:

```sh
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --ws websockets --ws-max-size 393216 --ws-max-queue 4 --ws-per-message-deflate false
```

If your Render service is Docker-based, leave **Docker Command** empty so this CMD runs. If an override exists, update it to execute this command through `sh -c`. If it is a native Python service rooted at `backend`, use this as its Start Command and keep `pip install -r requirements.txt` as its build command. Render overrides take precedence over Dockerfile CMD. [Render Docker documentation](https://render.com/docs/docker)

Keep one instance and one worker: room broadcasts are intentionally in-process, with no Redis. Preserve the existing `DATABASE_URL` and `ALLOWED_ORIGINS` configuration. Migrations run at startup, so a paid pre-deploy command or interactive shell is unnecessary. Check deployment logs for `0004_voice_questions` and a healthy `/health` response before frontend smoke testing.

Free-host sleep/restarts still interrupt sockets and intentionally lose transient audio. The existing client reconnects; metadata is restored, and timed rounds recover from their persisted deadline on reconnect. Render may sleep without traffic or restart a free service. No artificial keep-alive service was added. [Render free-service behavior](https://render.com/docs/free)

**Vercel:** preserve the existing Vite project, `npm run build`, and `dist` output. No new environment variable or configuration file is required. Confirm the existing production `VITE_API_URL` is the HTTPS Render base URL and `VITE_WS_URL` is its WSS base URL. Do not append `/api` or `/ws` to those base URLs. Redeploy the frontend to include the recorder and authenticated handshake. If an existing variable is corrected, a new deployment is required for it to take effect. [Vercel environment variables](https://vercel.com/docs/environment-variables)

**Neon:** no storage bucket or audio table is needed; only the Alembic metadata migration runs using the existing connection. Do not manually create these columns if Alembic manages the schema.

Deploy backend and frontend together during a quiet period, after approval. Older frontend bundles lack the new WebSocket authentication frame, so ask players to refresh once both deployments are ready. Then repeat the three-device smoke test over the deployed HTTPS site. Nothing has been pushed or deployed as part of this implementation.
