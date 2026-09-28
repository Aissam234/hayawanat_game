# Offline AI mode

## Routes and isolation

`/` selects Online Friends (`/friends`) or Local AI (`/ai`). Existing invite URLs
`/?join=CODE` forward to the online home with their query unchanged. Lobby and
game routes are unchanged. Authentication and account refresh only mount on
online routes. Leaving them aborts pending requests, stops socket reconnects,
and ignores late initialization responses. Online rules are unchanged.

AI mode makes no API calls and has no auth, room, socket or database dependency.
Its page, engine and all 60 animal records are eagerly bundled, not lazy-loaded.
Cairo (SIL OFL, license in `frontend/src/CAIRO-LICENSE.txt`) and the favicon are
embedded. Existing music and effects are generated locally. No paid dependency
or external inference is used; no new npm packages are required.

## Reasoning and flow

`features/ai-mode/engine.ts` contains pure candidate, question and guess helpers.
`ReasoningState` accepts candidates, already-asked question IDs and difficulty
only. It cannot receive the round or either secret. Question quality is
`min(yesCount, noCount)`: hard selects the maximum; medium sometimes chooses
from the best three; easy sometimes picks any useful split. Randomness is
injected for tests. Repeated and non-splitting questions are excluded.

One candidate always triggers a guess. Hard risks a guess with two. Other
levels ask another useful question when possible; if attributes cannot separate
candidates, every difficulty eventually guesses. Wrong guesses remove that
candidate. Contradictory answers which empty the candidate set are rejected
without inspecting the secret; the player can correct the answer or skip it.

`round.ts` separately owns both secrets and validates guesses. Both animals are
different. Human questions use the human secret; the human sees the AI secret.
The reasoning engine receives every allowed animal initially (including the
human's visible-to-AI animal), as requested, rather than secret-based exclusions.

Flow: setup -> human -> answering (800–1100ms) -> AI thinking -> AI question ->
human answer -> human. Invalid AI questions retain AI's turn with a new question,
matching online rules. A wrong guess passes the turn; a correct guess ends the
round and increments that side's session score exactly once. Local deadlines
end the round in a draw and are checked on actions and visibility changes, not
only on interval ticks. Both animals, counts and duration are revealed at end.

## Persistence and limitations

Round state, scoreboard, settings, and question draft are saved under the versioned
`hayawanat.ai-round.v1` localStorage key. Refreshing or returning to AI mode restores
the latest local round. Pending answers/thinking resume, finished rounds do not award
points again, and timers retain their original wall-clock deadline. Invalid saves
are discarded safely; blocked storage shows an Arabic warning without preventing play.
Progress belongs to this browser/device and is lost if site data is cleared. There is
no cloud scoring. Existing sound preferences continue using their own keys.
Persistence checks: `node tests/ai-persistence.test.cjs` and
`node tests/ai-persistence.e2e.cjs` (against the production preview).

Offline means **after the app has loaded**; this does not add a service worker
or promise a cold launch/reload without Internet. Local browser DevTools can
inspect in-memory secrets: the fairness guarantee is separation of reasoning
and normal UI visibility, not tamper-proof local storage. Answers follow the
existing multiplayer dataset's simplified traits, not arbitrary Arabic NLP.
Structured categories are type, habitat, size, diet and abilities.

## Arabic and Darija conversation

`arabic.ts` normalizes diacritics and common spelling variants and matches whole
clauses against a bounded offline grammar. Examples: `واش كنسبح؟`,
`هل أنا من الثدييات؟`, `واش ما كنسبحش؟`. It supports clear negation and up to
two supported clauses. Food alternatives are answered separately, not silently
treated as a conjunction. Unmatched qualifiers (poisonous plants, space, etc.)
cause clarification rather than partial keyword matching.

The player reviews and confirms canonical meaning before spending a turn.
Ambiguous water/sea questions offer habitat-versus-swimming clarification; the
catalog cannot distinguish saltwater and freshwater. Unsupported questions and
rephrasing an already-answered property keep the player's turn. A running round
timer continues during clarification. Compound questions cost one turn and get
two separate answers. Normal question/answer history retains the player's own
wording and the replies. Structured suggestions remain in a collapsible panel.

The interpreter cannot read either secret; only the round answer function gets
the human secret after confirmation. This is template-based semantic parsing,
not unrestricted Arabic NLP. It does not infer new animal facts from words:
for example wings are not equated with the existing flight field. The local
catalog and its simplified classifications remain the source of truth.

`node tests/arabic-questions.test.cjs` checks 33 normalization, dialect, negation,
compound, ambiguity, unsupported-qualifier, repetition and turn-state cases.

## Removed files (relative to the previous working implementation)

- `frontend/src/pages/SoloPage.tsx` and `SoloPage.css`
- `frontend/tests/solo.e2e.cjs`
- `backend/app/api/solo.py` and `backend/tests/test_solo.py`
- `docs/SOLO_DETECTIVE.md`

Removed the old route/button, router registration, model/schema fields, reward
avatars and the three dedicated sound effects/test cases. There was no separate
old Zustand store or browser-storage key to delete. Some of these were untracked
working files, so Git records their absence rather than a tracked deletion.

## Added files

- `frontend/src/features/ai-mode/{animals.json,engine.ts,round.ts,AiPage.tsx}`
- `frontend/src/pages/ModeMenu.tsx`
- `frontend/src/offline-font.css` and `CAIRO-LICENSE.txt`
- `frontend/tests/ai-mode.test.cjs` and `ai-mode.e2e.cjs`
- `backend/migrations/versions/0010_remove_retired_progress.py`
- This document

## Modified integration files

- `App.tsx`: mode routes and scoped online account boundary
- `HomePage.tsx`: online-only home and menu return button
- `GamePage.tsx` / `LobbyPage.tsx`: cancel late initialization after leaving
- `services/api.ts`: abort pending online requests and accept auth AbortSignal
- `index.html` / `index.css`: embedded favicon/font; no Google Fonts requests
- `components/auth/Avatar.tsx`, `services/soundDesign.ts`, sound tests:
  removed the retired reward assets and sounds
- `tests/password-auth.e2e.cjs`: updated online entry/logout navigation
- Backend `main.py`, `models/models.py`, `schemas/schemas.py`: removed retired
  functionality; online gameplay services are untouched

The previously added LAN UUID fallback in `utils/session.ts` remains intact.

## Database compatibility and deployment

Historical migration `0009_solo_detective.py` is retained because it has already
been applied locally. Its name and the cleanup migration's references are the
only intentional retired-mode remnants. Deleting applied migration history
would break upgrades. Migration 0010 drops only `users.solo_round` and
`users.solo_stars`, and resets the five retired reward-avatar IDs to `lion`.
Accounts, passwords, multiplayer scores, rooms and matches are preserved.
Downgrade recreates empty retired columns, not deleted progress.

AI requires no backend change or env setting, but **cleanup does require the
normal `alembic upgrade head` step**. No production database was touched. No
commit, push or deployment was performed. Backend migration/runtime tests must
pass on disposable PostgreSQL before deployment approval.

## Verification (2026-09-26)

- 27 focused engine/state checks passed: pool selection, distinct secrets, UI
  view, answer filtering, question strategy, secret-free reasoning signature,
  guesses, invalid/repeated questions, turn changes, rematch score, timer and
  removal/network dependency checks.
- Production browser test passed with Internet disabled before entering `/ai`:
  **zero requests and zero WebSockets**. Covered guest play, structured
  questions, AI question/human answer, win/reveal, rematch, session scores,
  20-second local expiry and layouts at 320, 414 and 1280 pixels.
- A second fresh browser context with a saved expired account enters `/ai`
  without an authentication request; focus events do not refresh it.
- TypeScript typecheck and production build passed.
- Online backend/voice/reconnect/database regressions could not run: Docker
  Desktop's engine crashed during inference-manager startup. This is a pending
  verification gate, not a passing regression result.

Run engine checks from `frontend`: `node tests/ai-mode.test.cjs` (TypeScript must
be installed). Browser tests use Playwright and Edge, or BROWSER_PATH; TEST_URL
defaults to `http://127.0.0.1:15178` running `npm run preview -- --port 15178`.
Optional SHOT_DIR captures screenshots. Use production preview for the network
audit: Vite dev mode has its own development WebSocket.

### AI arena presentation
The offline AI screen now has a scoped mint/gold arena theme, a local SVG robot,
responsive setup and game panels, turn feedback, and an animated result reveal.
Animations use CSS transforms/opacity; decorative animations stop after a few cycles,
and all arena motion respects prefers-reduced-motion. The existing sound controls remain shared.
No dependencies, remote assets, backend changes, or new environment variables are required.
This is a web interface update, not Android packaging or Play Store submission.
Verify with `node tests/ai-arena.e2e.cjs` and `node tests/ai-mode.e2e.cjs` after the production build.
The arena test covers 320/414/1280px layouts, mobile card widths, reduced motion,
iOS-friendly input font sizing, and modal keyboard focus/Escape.
