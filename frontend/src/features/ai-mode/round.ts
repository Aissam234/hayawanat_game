import {
  AnimalLevel, Difficulty, Answer, AiAction, CatalogueVersion, CATALOGUE_VERSION, getCatalogueAnimal,
  answerHumanQuestion, filterCandidates,
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
  catalogueVersion?: CatalogueVersion
  id: number
  settings: Settings
  humanSecret: number
  aiSecret: number
  pool: number[]
  candidates: number[]
  asked: string[]
  humanAsked: string[]
  history: Entry[]
  phase: 'human' | 'answering' | 'thinking' | 'ai-question' | 'review' | 'finished'
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
  '💡 حسب الأجوبة بقى احتمال واحد:',
  '✅ الأدلة اللي عندي كتشير إلى:',
  '🏆 لقيتها! الحيوان ديالي هو:',
]
const WRONG_GUESS_REACTIONS = [
  'آه لا 😅 ماشي هو. نكمّلو! دورك دابا.',
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
    catalogueVersion: CATALOGUE_VERSION,
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
  | { type: 'ask'; questionId: string; negated?: boolean; now: number }
  | { type: 'answer-human'; now: number }
  | { type: 'human-guess'; animalId: number; now: number }
  | { type: 'ai-action'; action: AiAction; now: number; random?: () => number }
  | { type: 'answer-ai'; answer: Answer; now: number }
  | { type: 'correct-answer'; index: number; answer: Answer; now: number }
  | { type: 'resume-review'; now: number }
  | { type: 'tick'; now: number }

// Rebuild only from recorded answers and verified wrong guesses, never secrets.
export function rebuildCandidates(state: Pick<Round,'pool'|'history'|'catalogueVersion'>): number[] {
  let candidates=state.pool.map(id=>getCatalogueAnimal(id,state.catalogueVersion ?? 1))
  for(const entry of state.history){
    if(entry.side!=='ai')continue
    if(entry.kind==='question')candidates=filterCandidates(candidates,getQuestion(String(entry.value))!,entry.answer as Answer)
    else if(entry.answer===false)candidates=candidates.filter(a=>a.id!==entry.value)
  }
  return candidates.map(a=>a.id)
}
const reviewMessage='همم 🤔 الأجوبة ما بقاتش متوافقة. نراجعوها؟ صحّح جواباً أو اختار «غير متأكد» لتجاهل المعلومة، ثم نكمّلو نفس الجولة.'

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

  const version = state.catalogueVersion ?? 1
  const lookup = (id:number) => getCatalogueAnimal(id,version)
  const available = (id:string) => getQuestion(id) && (!getQuestion(id)!.minCatalogueVersion || version===2)
  const rng = (event as { random?: () => number }).random ?? Math.random

  if(event.type==='correct-answer' && state.phase==='review'){
    const entry=state.history[event.index]
    if(!entry || entry.side!=='ai' || entry.kind!=='question' || !['yes','no','invalid'].includes(event.answer))return state
    const history=state.history.map((h,i)=>i===event.index?{...h,answer:event.answer}:h)
    const candidates=rebuildCandidates({...state,history})
    return {...state,history,candidates,message:candidates.length?'الأجوبة متوافقة الآن. تقدر تراجع الباقي أو تكمّل الجولة.':reviewMessage}
  }
  if(event.type==='resume-review' && state.phase==='review'){
    const candidates=rebuildCandidates(state)
    return candidates.length?{...state,candidates,phase:'human',message:'نكملو! دورك الآن.',pending:undefined}:state
  }

  // ── Human types a question in Arabic ──────────────────────────────────────
  if (event.type === 'ask-text' && state.phase === 'human') {
    const parsed = interpretArabic(event.text)
    if (parsed.kind !== 'understood') return { ...state, message: parsed.message }
    if (parsed.parts.some(p => !available(p.questionId))) return {...state,message:'هاد الجولة محفوظة بالمعلومات القديمة. الصفات الجديدة متاحة فالجولة المقبلة؛ دورك باقي ليك.'}
    if (parsed.parts.some(p => state.humanAsked.includes(p.questionId)))
      return {
        ...state,
        message:
          'سبق سولتي على هاد الصفة 😄 جرّب سؤال آخر. دورك باقي ليك.',
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
    available(event.questionId) &&
    !state.humanAsked.includes(event.questionId)
  )
    return { ...state, phase: 'answering', pending: event.questionId, pendingText: event.negated ? {text:`هل العكس صحيح: «${getQuestion(event.questionId)!.text}»؟`,parts:[{questionId:event.questionId,negated:true}]} : undefined, message: '' }

  // ── System answers the human's question ───────────────────────────────────
  if (event.type === 'answer-human' && state.phase === 'answering' && state.pending) {
    const answer = answerHumanQuestion(state.pending, state.humanSecret,version)
    const parts = state.pendingText?.parts || [{ questionId: state.pending, negated: false }]
    const reply = replyToMeanings(parts, state.humanSecret,version)
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
      return state.candidates.length ? state : { ...state, phase: 'review', pending: undefined, message: reviewMessage }

    if (
      action.type === 'question' &&
      available(action.questionId) &&
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
        message: `${wrongMsg}\n(خمّن الخصم ${lookup(action.animalId).name_ar} وأخطأ)`,
      }
    }
  }

  // ── Human answers the AI's question ──────────────────────────────────────
  if (event.type === 'answer-ai' && state.phase === 'ai-question' && state.pending) {
    const candidates = filterCandidates(
      state.candidates.map(lookup),
      getQuestion(state.pending)!,
      event.answer,
    ).map(a => a.id)

    const invalidReaction = pick(ANSWER_INVALID_REACTIONS, rng)
    return {
      ...state,
      candidates,
      asked: [...state.asked, state.pending],
      pending: undefined,
      phase: !candidates.length ? 'review' : event.answer === 'invalid' ? 'thinking' : 'human',
      message: !candidates.length ? reviewMessage : event.answer === 'invalid' ? invalidReaction : 'دورك الآن!',
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
export function buildAiGuessMessage(action: AiAction & { type: 'guess' }, rng: () => number, version: CatalogueVersion = 2): string {
  const animal = getCatalogueAnimal(action.animalId,version)
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
    opponent: getCatalogueAnimal(state.aiSecret,state.catalogueVersion ?? 1),
    own: state.phase === 'finished' ? getCatalogueAnimal(state.humanSecret,state.catalogueVersion ?? 1) : null,
  }
}
