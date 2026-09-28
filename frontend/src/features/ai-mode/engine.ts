import data from './animals.json'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type AnimalLevel = Difficulty | 'random'
export type Animal = typeof data[number]
export const animals: readonly Animal[] = data
export type Answer = 'yes' | 'no' | 'invalid'
export type Question = { id: string; category: string; text: string; test: (animal: Animal) => boolean }

const bool = (id: keyof Animal, text: string, category = 'الصفات'): Question => ({
  id, text, category, test: a => Boolean(a[id]),
})

export const QUESTION_PREFIX = 'هل الحيوان عندي؟'
export const formatQuestion = (text: string) =>
  `${QUESTION_PREFIX} ${text.replace(/^هل الحيوان عندي\s*[.؟?]*\s*/, '')}`

export const questions: readonly Question[] = [
  bool('is_mammal', 'هل هو من الثدييات؟', 'النوع'),
  bool('is_domestic', 'هل يُستأنَس؟ يعيش في البيت؟', 'النوع'),
  bool('has_fur', 'هل يغطيه جسم الفراء؟', 'النوع'),
  bool('has_horns', 'هل لديه قرون؟', 'النوع'),
  bool('has_tail', 'هل لديه ذيل؟', 'النوع'),
  bool('can_fly', 'هل يستطيع الطيران بحسب طبيعة اللعبة؟'),
  bool('can_swim', 'هل يستطيع السباحة بحسب طبيعة اللعبة؟'),
  bool('is_nocturnal', 'هل يمشي ليلاً؟'),
  bool('lives_in_groups', 'هل يعيش في مجموعات؟'),
  bool('is_african', 'هل موطنه إفريقيا؟', 'الموطن'),
  ...(['water', 'land', 'desert', 'jungle', 'arctic', 'air', 'domestic'] as const).map(
    (value, i) => ({
      id: 'habitat_' + value,
      category: 'الموطن',
      text: [
        'هل موطنه الماء؟',
        'هل موطنه البر؟',
        'هل يعيش في الصحراء؟',
        'هل يعيش في الغابة؟',
        'هل يعيش في المناطق الباردة؟',
        'هل موطنه المناطق هو الهواء؟',
        'هل موطنه المنزل أو المزرعة؟',
      ][i],
      test: (a: Animal) => a.habitat === value,
    }),
  ),
  ...(['small', 'medium', 'large', 'huge'] as const).map((value, i) => ({
    id: 'size_' + value,
    category: 'الحجم',
    text: ['هل حجمه صغير؟', 'هل حجمه متوسط؟', 'هل حجمه كبير؟', 'هل حجمه ضخم؟'][i],
    test: (a: Animal) => a.size === value,
  })),
  ...(['herbivore', 'carnivore', 'omnivore'] as const).map((value, i) => ({
    id: 'diet_' + value,
    category: 'الغذاء',
    text: [
      'هل يأكل النباتات؟',
      'هل يفترس ويأكل لحوم؟',
      'هل يأكل النباتات والحيوانات معاً؟',
    ][i],
    test: (a: Animal) => a.diet === value,
  })),
]

export const getAnimal = (id: number) => animals.find(a => a.id === id)!
export const getQuestion = (id: string) => questions.find(q => q.id === id)

export const getInitialCandidates = (level: AnimalLevel): Animal[] =>
  animals.filter(a => level === 'random' || a.difficulty === level)

export const evaluateQuestionSplit = (candidates: readonly Animal[], question: Question) => {
  const yes = candidates.filter(question.test).length
  return { yes, no: candidates.length - yes, score: Math.min(yes, candidates.length - yes) }
}

export const filterCandidates = (
  candidates: readonly Animal[],
  question: Question,
  answer: Answer,
): Animal[] =>
  answer === 'invalid'
    ? [...candidates]
    : candidates.filter(a => question.test(a) === (answer === 'yes'))

export const getPossibleQuestions = (
  candidates: readonly Animal[],
  asked: readonly string[],
): Question[] =>
  questions.filter(q => !asked.includes(q.id) && evaluateQuestionSplit(candidates, q).score > 0)

/**
 * 2-level lookahead: picks the question that maximises the *minimum* worst-case
 * candidates left after two questions (minimax over the yes/no branches).
 * Falls back to the simpler single-level split score when no lookahead gain exists.
 */
export function chooseBestQuestion(
  candidates: readonly Animal[],
  asked: readonly string[],
): Question | undefined {
  const possible = getPossibleQuestions(candidates, asked)
  if (!possible.length) return undefined

  let bestQuestion: Question | undefined
  let bestScore = -1

  for (const q of possible) {
    const { yes, no } = evaluateQuestionSplit(candidates, q)
    const yesBranch = candidates.filter(q.test)
    const noBranch = candidates.filter(a => !q.test(a))

    // For each branch, compute the best follow-up split score available
    const bestFollowUp = (branch: readonly Animal[]) => {
      if (branch.length <= 1) return 0
      const followUps = getPossibleQuestions(branch, [...asked, q.id])
      if (!followUps.length) return 0
      return Math.max(...followUps.map(fq => evaluateQuestionSplit(branch, fq).score))
    }

    // Primary: single-level information gain (balanced split)
    const singleLevel = Math.min(yes, no)
    // Secondary: lookahead bonus — how well we can split either branch next turn
    const lookaheadBonus =
      (bestFollowUp(yesBranch) / Math.max(yesBranch.length, 1) +
        bestFollowUp(noBranch) / Math.max(noBranch.length, 1)) *
      0.5

    // Combined score: primary drives the choice, lookahead breaks ties
    const score = singleLevel * 100 + lookaheadBonus * candidates.length

    if (score > bestScore) {
      bestScore = score
      bestQuestion = q
    }
  }

  return bestQuestion
}

// ---------------------------------------------------------------------------
// Confidence-based guessing
// ---------------------------------------------------------------------------

/**
 * Returns a confidence score [0,1] for a candidate being the target animal,
 * based on how uniquely it is distinguished from the remaining pool.
 * Higher = more likely to be the right guess.
 */
function candidateConfidence(candidate: Animal, candidates: readonly Animal[]): number {
  if (candidates.length <= 1) return 1
  // Count questions that uniquely identify this candidate vs the rest
  const uniqueFeatures = questions.filter(q => {
    const val = q.test(candidate)
    return candidates.filter(a => a !== candidate).every(a => q.test(a) !== val)
  }).length
  return uniqueFeatures / Math.max(questions.length, 1)
}

/**
 * Picks the best guess from candidates, preferring the one most uniquely
 * identifiable — i.e. the one the AI is most confident about.
 */
export function pickBestGuess(
  candidates: readonly Animal[],
  random: () => number,
): Animal {
  if (candidates.length === 1) return candidates[0]

  // Score each candidate
  const scored = candidates.map(a => ({
    animal: a,
    confidence: candidateConfidence(a, candidates),
  }))
  scored.sort((a, b) => b.confidence - a.confidence)

  // If the top candidate is clearly better (≥50% confidence boost), pick it
  if (scored[0].confidence > 0.1 && scored[0].confidence > scored[1].confidence * 1.5) {
    return scored[0].animal
  }

  // Otherwise random among the top half
  const top = scored.slice(0, Math.max(1, Math.ceil(scored.length / 2)))
  return top[Math.floor(random() * top.length)].animal
}

// ---------------------------------------------------------------------------
// AI Action Selection
// ---------------------------------------------------------------------------

export type ReasoningState = {
  candidates: readonly Animal[]
  asked: readonly string[]
  difficulty: Difficulty
}
export type AiAction =
  | { type: 'question'; questionId: string }
  | { type: 'guess'; animalId: number; confidence: 'certain' | 'confident' | 'uncertain' }
  | { type: 'exhausted' }

export function chooseAiAction(knowledge: ReasoningState, random: () => number): AiAction {
  const { candidates, asked, difficulty } = knowledge
  if (!candidates.length) return { type: 'exhausted' }

  // ── Decide whether to guess now based on confidence ────────────────────────
  const best = pickBestGuess(candidates, random)
  const conf = candidateConfidence(best, candidates)

  // On hard: guess if only 1-2 left OR very high confidence
  if (difficulty === 'hard') {
    if (candidates.length <= 2 || conf > 0.6) {
      const animal = candidates.length <= 1 ? candidates[0] : best
      return {
        type: 'guess',
        animalId: animal.id,
        confidence: conf > 0.8 ? 'certain' : conf > 0.5 ? 'confident' : 'uncertain',
      }
    }
  }

  // On medium: guess if 1 left, or 2-3 left with confidence > 0.4
  if (difficulty === 'medium') {
    if (
      candidates.length === 1 ||
      (candidates.length <= 3 && conf > 0.4)
    ) {
      return {
        type: 'guess',
        animalId: best.id,
        confidence: conf > 0.7 ? 'certain' : conf > 0.4 ? 'confident' : 'uncertain',
      }
    }
  }

  // On easy: only guess when 100% certain (1 candidate)
  if (difficulty === 'easy' && candidates.length === 1) {
    return { type: 'guess', animalId: candidates[0].id, confidence: 'certain' }
  }

  // ── Pick a question ────────────────────────────────────────────────────────
  const ranked = getPossibleQuestions(candidates, asked).sort(
    (a, b) =>
      evaluateQuestionSplit(candidates, b).score - evaluateQuestionSplit(candidates, a).score,
  )
  if (!ranked.length) {
    // No useful questions left — just guess
    return {
      type: 'guess',
      animalId: best.id,
      confidence: 'uncertain',
    }
  }

  // Use lookahead-optimised selection (already does it internally in chooseBestQuestion)
  const optimal = chooseBestQuestion(candidates, asked)

  // Difficulty-based noise: easy sometimes picks a random question, medium slightly
  let chosenQuestion = optimal ?? ranked[0]
  if (difficulty === 'easy' && random() < 0.45) {
    chosenQuestion = ranked[Math.floor(random() * ranked.length)]
  } else if (difficulty === 'medium' && random() < 0.2) {
    chosenQuestion = ranked[Math.floor(random() * Math.min(3, ranked.length))]
  }

  return { type: 'question', questionId: chosenQuestion.id }
}

export const validateGuess = (guessId: number, secretId: number) => guessId === secretId

export const answerHumanQuestion = (questionId: string, humanSecret: number): Answer => {
  const q = getQuestion(questionId)
  if (!q) return 'invalid'
  return q.test(getAnimal(humanSecret)) ? 'yes' : 'no'
}

export function selectSecrets(pool: readonly Animal[], random: () => number): [number, number] {
  if (pool.length < 2) throw new Error('At least two animals are required')
  const first = Math.floor(random() * pool.length)
  const second = (first + 1 + Math.floor(random() * (pool.length - 1))) % pool.length
  return [pool[first].id, pool[second].id]
}
