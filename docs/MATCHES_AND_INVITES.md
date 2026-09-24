# Room invitations and best-of-three matches

The lobby offers a shareable link and a locally rendered QR code. Links contain only the room code, never account tokens or room session secrets. Opening a link fills in the join form; after signing in, the player confirms joining. Invalid or closed rooms use the existing join error messages.

Hosts can select a single round or best-of-three (first to two wins). The two players stay the same when using **Next round** on the result card. A round without a winner adds no win, so a match can require more than three attempts. After a champion is declared, the same button starts a fresh match. Starting from the lobby always starts a new match with the selected players. Individual round wins continue to award the existing account point; no extra champion points are added.

Match IDs are stored on rounds. Scores and champions are derived from recorded winners, including on reconnect. No background scheduler, paid service, audio storage or third-party QR API is added.

Deployment requires both frontend and backend updates. The existing backend startup command must run `alembic upgrade head`, applying `0007_match_series`. Existing rounds remain single rounds. No new environment variables are required. The frontend lockfile includes `qrcode.react`.

Validation for this change: frontend production build and mobile-width invite/QR browser checks passed. The PostgreSQL regression test `backend/tests/test_matches.py` covers host permission, duplicate start rejection, score continuation, cancelled rounds, reconnect/champion state and starting a fresh series. Run it with the full backend suite against an explicitly disposable database (`HAYAWANAT_TEST_DATABASE=1`). Verification completed after Docker recovered: all migrations applied successfully to a fresh disposable PostgreSQL database, and the full backend suite passed (52 tests).
