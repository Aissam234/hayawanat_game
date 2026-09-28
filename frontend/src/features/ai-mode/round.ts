import {
  AnimalLevel, Difficulty, Answer, AiAction,
  answerHumanQuestion, filterCandidates, getAnimal,
  getInitialCandidates, getQuestion, selectSecrets, validateGuess,
} from './engine'
import { interpretArabic, Meaning, replyToMeanings } from './arabic'

export type Settings = { difficulty: Difficulty; animalLevel: AnimalLevel; timer: 0 | 20 | 30 | 60 }
export type Entry = {
  side: 'human' | 'ai'
  kind: 'question' | 'guess'
  value: string | number
  answer: Answer | boolean
  text?: string
  reply?: string
}
export type Round = {
  id: number
  settings: Settings
  humanSecret: number
  aiSecret: number
  pool: number[]
  candidates: number[]
  asked: string[]
  humanAsked: string[]
  history: Entry[]
  phase: 'human' | 'answering' | 'thinking' | 'ai-question' | 'finished'
  pending?: string
  pendingText?: { text: string; parts: Meaning[] }
  winner: 'human' | 'ai' | null
  reason?: 'timeout' | 'exhausted'
  started: number
  ended?: number
  scores: { human: number; ai: number }
  message: string
}

// ---------------------------------------------------------------------------
// AI personality messages — vary by confidence & situation
// ---------------------------------------------------------------------------
const CONFIDENT_GUESS_MSGS = [
  '🤖 أنا واثق جداً… أعتقد أنه:',
  '🧠 حللت الإجابات. تقريباً متأكد أنه:',
  '🎯 كل الأدلة تشير إلى حيوان واحد:',
]
const UNCERTAIN_GUESS_MSGS = [
  '🤔 الخيارات كثيرة بعد، لكن سأخمن:',
  '🎲 لديّ تخمين، لكن ليس متيقناً تماماً:',
  '🔍 بناءً على ما عندي، أقول:',
]
const CERTAIN_GUESS_MSGS = [
  '💡 أنا متأكد 100% — الجواب هو:',
  '✅ لا شك عندي — هو:',
  '🏆 وجدته! إنه:',
]
const WRONG_GUESS_REACTIONS = [
  '😤 عجيب! لم يكن هذا. دورك يا بطل!',
  '🤨 خطأ! لكن لا مشكلة، سأحاول مجدداً. دورك!',
  '😅 اشتبهت عليّ الأدلة. المنافسة تستمر — دورك!',
]
const ANSWER_INVALID_REACTIONS = [
  'سؤالي غير صالح؟ حسناً، سأسأل بطريقة أخرى.',
  'فهمت — سأختار سؤالاً أوضح.',
  'لا بأس، سأبحث من زاوية مختلفة.',
]

function pick<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)]
}

// ---------------------------------------------------------------------------

export function startRound(
  settings: Settings,
  previous: Round | null,
  now: number,
  random: () => number,
): Round {
  const pool = getInitialCandidates(settings.animalLevel)
  const [humanSecret, aiSecret] = selectSecrets(pool, random)
  return {
    id: (previous?.id || 0) + 1,
    settings: { ...settings },
    humanSecret,
    aiSecret,
    pool: pool.map(a => a.id),
    candidates: pool.map(a => a.id),
    asked: [],
    humanAsked: [],
    history: [],
    phase: 'human',
    winner: null,
    started: now,
    scores: previous ? { ...previous.scores } : { human: 0, ai: 0 },
    message: '',
  }
}

export type Event =
  | { type: 'ask-text'; text: string; now: number }
  | { type: 'ask'; questionId: string; now: number }
  | { type: 'answer-human'; now: number }
  | { type: 'human-guess'; animalId: number; now: number }
  | { type: 'ai-action'; action: AiAction; now: number; random?: () => number }
  | { type: 'answer-ai'; answer: Answer; now: number }
  | { type: 'tick'; now: number }

export function transition(state: Round, event: Event): Round {
  if (state.phase === 'finished') return state

  // Timer expiry
  if (state.settings.timer && event.now >= state.started + state.settings.timer * 1000)
    return {
      ...state,
      phase: 'finished',
      reason: 'timeout',
      ended: state.started + state.settings.timer * 1000,
      pending: undefined,
    }

  const finish = (side: 'human' | 'ai', history: Entry[]): Round => ({
    ...state,
    history,
    phase: 'finished',
    winner: side,
    ended: event.now,
    pending: undefined,
    scores: { ...state.scores, [side]: state.scores[side] + 1 },
  })

  const rng = (event as { random?: () => number }).random ?? Math.random

  // ── Human types a question in Arabic ──────────────────────────────────────
  if (event.type === 'ask-text' && state.phase === 'human') {
    const parsed = interpretArabic(event.text)
    if (parsed.kind !== 'understood') return { ...state, message: parsed.message }
    if (parsed.parts.some(p => state.humanAsked.includes(p.questionId)))
      return {
        ...state,
        message:
          'سبق أن أجبت عن هذه الصفة. راجع سجل المحادثة أو اسأل عن صفة جديدة؛ دورك ما زال مستمراً.',
      }
    return {
      ...state,
      phase: 'answering',
      pending: parsed.parts[0].questionId,
      pendingText: parsed,
      message: '',
    }
  }

  // ── Human picks a question from the list ──────────────────────────────────
  if (
    event.type === 'ask' &&
    state.phase === 'human' &&
    getQuestion(event.questionId) &&
    !state.humanAsked.includes(event.questionId)
  )
    return { ...state, phase: 'answering', pending: event.questionId, message: '' }

  // ── System answers the human's question ───────────────────────────────────
  if (event.type === 'answer-human' && state.phase === 'answering' && state.pending) {
    const answer = answerHumanQuestion(state.pending, state.humanSecret)
    const parts = state.pendingText?.parts || [{ questionId: state.pending, negated: false }]
    const reply = replyToMeanings(parts, state.humanSecret)
    return {
      ...state,
      phase: 'thinking',
      humanAsked: [...state.humanAsked, ...parts.map(p => p.questionId)],
      history: [
        ...state.history,
        {
          side: 'human',
          kind: 'question',
          value: state.pending,
          answer,
          text: state.pendingText?.text,
          reply,
        },
      ],
      pending: undefined,
      pendingText: undefined,
      message: reply,
    }
  }

  // ── Human guesses ─────────────────────────────────────────────────────────
  if (
    event.type === 'human-guess' &&
    state.phase === 'human' &&
    state.pool.includes(event.animalId)
  ) {
    const correct = validateGuess(event.animalId, state.humanSecret)
    const history: Entry[] = [
      ...state.history,
      { side: 'human', kind: 'guess', value: event.animalId, answer: correct },
    ]
    return correct
      ? finish('human', history)
      : { ...state, history, phase: 'thinking', message: 'تخمينك غير صحيح. الآن دور الخصم.' }
  }

  // ── AI takes its turn ─────────────────────────────────────────────────────
  if (event.type === 'ai-action' && state.phase === 'thinking') {
    const action = event.action

    if (action.type === 'exhausted')
      return { ...state, phase: 'finished', ended: event.now, reason: 'exhausted' }

    if (
      action.type === 'question' &&
      getQuestion(action.questionId) &&
      !state.asked.includes(action.questionId)
    )
      return { ...state, phase: 'ai-question', pending: action.questionId }

    if (action.type === 'guess' && state.candidates.includes(action.animalId)) {
      const correct = validateGuess(action.animalId, state.aiSecret)
      const history: Entry[] = [
        ...state.history,
        { side: 'ai', kind: 'guess', value: action.animalId, answer: correct },
      ]

      if (correct) return finish('ai', history)

      // Wrong guess — pick a personality reaction
      const wrongMsg = pick(WRONG_GUESS_REACTIONS, rng)
      return {
        ...state,
        history,
        candidates: state.candidates.filter(id => id !== action.animalId),
        phase: 'human',
        message: `${wrongMsg}\n(خمّن الخصم ${getAnimal(action.animalId).name_ar} وأخطأ)`,
      }
    }
  }

  // ── Human answers the AI's question ──────────────────────────────────────
  if (event.type === 'answer-ai' && state.phase === 'ai-question' && state.pending) {
    const candidates = filterCandidates(
      state.candidates.map(getAnimal),
      getQuestion(state.pending)!,
      event.answer,
    ).map(a => a.id)

    if (!candidates.length)
      return {
        ...state,
        message:
          'هذه الإجابة تناقض الأدلة السابقة. راجعها أو اختر «غير صالح» لتجاوز السؤال.',
      }

    const invalidReaction = pick(ANSWER_INVALID_REACTIONS, rng)
    return {
      ...state,
      candidates,
      asked: [...state.asked, state.pending],
      pending: undefined,
      phase: event.answer === 'invalid' ? 'thinking' : 'human',
      message: event.answer === 'invalid' ? invalidReaction : 'دورك الآن!',
      history: [
        ...state.history,
        { side: 'ai', kind: 'question', value: state.pending, answer: event.answer },
      ],
    }
  }

  return state
}

// ---------------------------------------------------------------------------
// Build a message the AI shows right before guessing
// ---------------------------------------------------------------------------
export function buildAiGuessMessage(action: AiAction & { type: 'guess' }, rng: () => number): string {
  const animal = getAnimal(action.animalId)
  const preamble =
    action.confidence === 'certain'
      ? pick(CERTAIN_GUESS_MSGS, rng)
      : action.confidence === 'confident'
      ? pick(CONFIDENT_GUESS_MSGS, rng)
      : pick(UNCERTAIN_GUESS_MSGS, rng)
  return `${preamble} ${animal.emoji} ${animal.name_ar}`
}

export function visibleRound(state: Round) {
  return {
    opponent: getAnimal(state.aiSecret),
    own: state.phase === 'finished' ? getAnimal(state.humanSecret) : null,
  }
}
