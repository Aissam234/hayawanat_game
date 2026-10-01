# Offline AI mode — current implementation

## Catalogue v2 (2026-09-30)

The offline AI mode now contains 120 animals (40 per difficulty pool) and 69
canonical questions. Random uses all animals. The multiplayer catalogue, account
authentication, scores and rewards are unchanged. No paid service, runtime API,
dependency, environment variable or database migration is added.

See [AI_CATALOGUE.md](AI_CATALOGUE.md) for all species, aliases, references,
editorial definitions and limitations. Scientific names anchor generic Arabic
names; the guess dialog supports Arabic/Darija/Arabizi aliases and scientific-name
search. Search changes clear any hidden previous selection. Existing UI themes,
animations, music/effects and reduced-motion behavior are preserved.

## Questions and language

The original 24 predicates remain available: mammal/domestic/fur/horns/tail,
flight/swimming, night activity, group living, African origin, seven habitat
categories, four sizes and three diets. There are 45 additional predicates:

- Wings, feathers, egg-laying, scales, shell/armour, spines, stripes, spots,
  long ears, trunk, tusks, mane, tail tuft, pouch, long neck, large bill, crest,
  flat tail, black-and-white colour and beard.
- Eight animal-group questions: bird, reptile, amphibian, fish, insect, arachnid,
  crustacean, mollusk.
- Seven leg categories: 0, 2, 4, 6, 8, 10, >10; one/two humps.
- Six additional origin-region questions, detritivore diet and live-prey feeding (predation).

`catalogueQuestions.ts` defines new question IDs, tests, Arabic text, reply text
and controlled aliases together. `lexicon.ts` maps reviewed tokens and phrases to
concepts. `arabic.ts` performs script detection, Unicode normalization, tokenization,
compositional clause parsing, negation, ambiguity handling and conversion to
`{questionId, negated}`. No global Arabizi digit substitutions, remote translation
or general-purpose model are involved.

Arabic, Darija and Arabizi equivalent phrasings share IDs, preventing duplicate
turns. AND can carry two explicit answers; OR requests clarification. Unknown
concepts and ambiguous meanings consume no turn. One bounded known-vocabulary typo
can offer a clarification, never a silent guess. Exact/reviewed lexical confidence
is not a calibrated probability. The new grammar includes wings, feathers, egg
laying, legs and geography; it still does not understand arbitrary conversation.

## Reasoning, fairness and performance

All surviving candidates have equal working weight. One-step expected count is
`E1=(yes²+no²)/n`. Two-step lookahead is
`E2=sum(branchSize/n * bestFollowupE1)`; singleton/unsplittable branches keep their
size. Minimise E2, then E1, then stable catalogue order. Entropy is diagnostic.

The expanded catalogue made repeated predicate evaluation costly. Selection now
precomputes a Boolean question/candidate matrix and uses pair intersections to
evaluate the same adaptive two-level branches. Tests compare its selected question
with the independent direct-tree evaluator across all pools and evidence branches.
The formula, tie order and anti-cheating boundary are unchanged.

Hard chooses the best question. Easy has a 45% branch selecting any useful question;
Medium has a 20% branch selecting among the top three immediate splits. One candidate
means guess; multiple candidates mean ask if a useful separator exists, otherwise
sample uniformly. A wrong guess is removed. No name, scientific name, alias, source
URL or secret ID is used to rank candidates.

Decision functions receive candidate facts, asked IDs, difficulty and RNG, never
Round or either secret. Separate adjudication knows secrets to answer human
questions and validate guesses. Local memory/storage are inspectable, so session
scores are never trusted multiplayer/account rewards.

## Saved-round compatibility

The outer localStorage key/schema remain `hayawanat.ai-round.v1` / version 1.
New rounds carry `catalogueVersion:2`. A missing catalogueVersion denotes the
original v1 catalogue. The full old animal JSON is frozen and bundled.

Old rounds retain their original 15/25/20/60 pools, names, trait answers, pending
question, candidate evidence, history, draft, settings, deadlines and session score.
They cannot ask new-only questions. The UI explains that a rematch unlocks the new
catalogue. Rematch carries session scores into a fresh v2 round. Invalid versions,
foreign question IDs and malformed saves are rejected. Refresh does not reset time.

This intentionally leaves old content mistakes unchanged inside an already-started
round; correcting its facts mid-round would invalidate the player's deductions.

## Offline scope

Animal records, lexicons and reasoning are bundled locally. Reference URLs are
metadata only and are never fetched during play. Existing app-shell offline limits
remain: play after loading is local; no service worker guarantees a cold offline
visit or reload. The previous v1 production-browser audit observed zero requests
after load. That is historical evidence, not a fresh v2 browser-network audit.

## Readiness audit on 2026-10-01

The reviewed readiness patch is now applied to the local working tree. The fixes
cover `كنعتبر مفترس`, `4 رجلي`, and preservation of negation when selecting a
clarification. Display wording and a personality string were polished; canonical
IDs, the 120-animal dataset and the reasoning algorithm were not changed.

The applied project's 200-utterance corpus and semantic regressions pass, along
with engine, parser, catalogue, persistence, recovery and reasoning suites.
All 7140 pairs select a separating question where available. No duplicate signatures.
Hard: 120/120 targets, average 6.942, median 7, minimum 6, worst 8 questions.
Easy and Medium: 2400 seeded runs each, averages 8.148 and 6.960. Across 4920 runs,
zero wrong guesses or stuck cases; one final guess per target.

The normal `npm run build` (TypeScript plus Vite) passes. JS is 584.32 kB raw /
162.45 kB gzip, with the existing nonblocking >500 kB warning.

Docker regression tests ran against a new disposable PostgreSQL database with
current backend code mounted read-only: 55 passed, 1 skipped. The skipped test
requires a separately running Uvicorn server to exercise oversized transport
frames. Migrations reached head. The disposable database and network were removed.
No existing database was used, and no online/backend code was changed.

Release sign-off remains pending browser verification: production offline network
traffic, 320/375/390/414px layouts, Safari/iPhone keyboard and landscape, and actual
browser refresh. Existing session browser restrictions remain in force. Backend
integration tests do not substitute for browser or physical-device checks.
No commit, push or deployment occurred.

## Benchmark

`AI_BENCHMARK.json` is the new catalogue's measured report. `AI_BENCHMARK_V1.json`
preserves the historical 60-animal results; do not directly interpret different
catalogues as a before/after strategy comparison.

Every target in every pool was simulated with truthful answers; Easy/Medium use
20 deterministic seeds, Hard one run per target. There are 9,840 total runs.
All completed; wrong guesses, stuck states and indistinguishable states were zero.
Success means eventual target identification without a turn/time budget, not a
win rate against human opponents or proof of biological correctness.

| Pool | Opponent | Runs | Average questions | Median | Worst |
|---|---|---:|---:|---:|---:|
| easy | easy | 800 | 6.234 | 6 | 9 |
| easy | medium | 800 | 5.404 | 5 | 7 |
| easy | hard | 40 | 5.400 | 5 | 6 |
| medium | easy | 800 | 6.237 | 6 | 10 |
| medium | medium | 800 | 5.405 | 5 | 7 |
| medium | hard | 40 | 5.400 | 5 | 6 |
| hard | easy | 800 | 6.194 | 6 | 10 |
| hard | medium | 800 | 5.402 | 5 | 6 |
| hard | hard | 40 | 5.400 | 5 | 6 |
| random | easy | 2400 | 8.148 | 8 | 12 |
| random | medium | 2400 | 6.960 | 7 | 9 |
| random | hard | 120 | 6.942 | 7 | 8 |

Balanced splitting on the same full v2 pool averages 6.958 questions; lookahead
averages 6.942. This is a modest measured benefit. Smaller pools tie at 5.4 for Hard.

## Reproduction and deployment

From `frontend`, run `npm run typecheck`, `npm run build`, then:

```text
node tests/ai-mode.test.cjs
node tests/arabic-questions.test.cjs
node tests/ai-language.test.cjs
node tests/ai-persistence.test.cjs
node tests/ai-catalogue.test.cjs
node tests/ai-reasoning.test.cjs
node tests/ai-benchmark.cjs
```

For browser validation in an environment permitting it, run the existing four AI
E2E suites against a production preview. Check the search dialog at 320/414px,
legacy-save restore, new game/rematch, and offline behavior after loading.

No deployment setting changes are needed. The previous backend setup still applies
to authentication/multiplayer. No commit, push, or deployment was performed.


## Predator-question regression (2026-09-30)

The exact mobile inputs `مفترس ؟` and `Wach yo3tabar moftaris ?` now
resolve to `is_predator`, with the existing explicit meaning-confirmation step.
Arabic/Arabizi copulas, reviewed spelling variants, attached Darija negation,
and the fixed question prefix are supported. Unknown modifiers still trigger
clarification without using a turn. Rephrasing does not bypass repeat detection.

This is a separate catalogue fact, not an alias for carnivore or dangerous.
The confirmation explicitly includes live insect and zooplankton prey, including
occasional predation. See AI_CATALOGUE.md for the scope and sources.
It is additive for catalogue-v2 saves; frozen v1 rounds retain their original
facts and offer the new question in the next round. Pending predator questions
and answered history both round-trip through save/restore.

Validation: all six engine/language/persistence/catalogue/reasoning suites pass,
including 16 new regression checks. The 9,840 deterministic/seeded benchmark runs
finish with zero incorrect guesses or stuck cases. TypeScript passes. Production
build uses the documented programmatic Vite workaround for this host's config
loader restriction. Physical iPhone/browser verification remains pending; no new
browser run was performed in this restricted session. No deployment variables,
paid services, account migrations, or backend changes are needed for this fix.

## Conflicting-answer recovery (2026-10-01)

An empty AI candidate set now enters `review`, not a finished round. A conflicting
answer is recorded so the player can correct that answer or any earlier AI answer.
The review offers yes/no/not-sure controls and an explicit resume button. Not-sure
ignores that clue; the question remains marked as asked. Candidate rebuilding uses
the original versioned pool, recorded AI answers and verified wrong AI guesses
only. It never uses either secret identity to repair the AI's knowledge.

Resume returns the turn to the human once the evidence is consistent. Secrets,
scores, history and the original deadline remain intact. Review and corrections
survive refresh. Timed rounds still expire during review. Wrong human guesses have
no attempt limit and pass the turn normally. Previous already-finished exhausted
saves stay finished because their secrets have already been revealed.

Validation: `node tests/ai-recovery.test.cjs` covers ten recovery/persistence/timer
and fairness cases, including 150 incorrect human guesses. All six existing AI
suites and TypeScript also pass. Browser/iPhone visual verification remains pending
in this restricted session. No backend or deployment-setting changes are required.


## Reproducing the final pass

`node tests/ai-production-readiness.cjs` writes the per-animal evidence JSON to the
current directory. `node tests/ai-readiness.test.cjs` asserts all 200 language cases
and selected-clarification negation. The latter checks the applied vocabulary and
negation fixes from the readiness patch. Run existing AI suites as listed above.
Do not treat static network isolation or state round-trips as browser/offline
certification. A cold offline refresh has no service-worker guarantee. Very long
rounds remain limited by the decoder's 1000-history / 250000-character safety caps.
