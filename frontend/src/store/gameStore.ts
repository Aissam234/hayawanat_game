import { create } from 'zustand'
import {
  Room, Participant, Round, Question, Animal,
  RoundFinishedData, WsEvent, GuestSession,
  GameSettings, ScoreboardEntry, ReactionEvent
} from '../types/game'
import { GameWebSocket } from '../services/websocket'
import { saveSession, loadSession } from '../utils/session'
import { toast } from './toastStore'

const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'medium',
  timer_duration: null,
  max_questions: null,
  allow_repeated: true,
  reactions_enabled: true,
}

interface GameState {
  // Session
  guestUuid: string
  displayName: string
  participantId: string
  myParticipant: Participant | null

  // Room
  room: Room | null
  participants: Participant[]

  // Round
  round: Round | null
  questions: Question[]
  roundFinished: RoundFinishedData | null

  // Animals
  animals: Animal[]

  // Game settings (host-controlled)
  settings: GameSettings

  // Scoreboard
  scoreboard: ScoreboardEntry[]

  // Live reactions (transient — not persisted)
  reactions: ReactionEvent[]

  // Timer: authoritative end time from server (ms epoch)
  timerEndsAt: number | null

  // WebSocket
  ws: GameWebSocket | null
  isConnected: boolean

  // UI State
  pendingQuestionId: string | null
  isMyTurn: boolean
  isPlayer: boolean
  isHost: boolean

  // Actions
  setSession: (session: Partial<GuestSession> & { guestUuid: string }) => void
  setRoom: (room: Room) => void
  setParticipants: (participants: Participant[]) => void
  setRound: (round: Round | null) => void
  setQuestions: (questions: Question[]) => void
  addQuestion: (question: Question) => void
  updateQuestion: (questionId: string, updates: Partial<Question>) => void
  setAnimals: (animals: Animal[]) => void
  setRoundFinished: (data: RoundFinishedData | null) => void
  setPendingQuestionId: (id: string | null) => void
  setSettings: (settings: Partial<GameSettings>) => void
  setScoreboard: (scoreboard: ScoreboardEntry[]) => void
  addReaction: (reaction: ReactionEvent) => void
  removeReaction: (id: string) => void
  setTimerEndsAt: (ts: number | null) => void
  connectWs: (roomCode: string, participantId: string) => void
  disconnectWs: () => void
  handleWsEvent: (event: WsEvent) => void
  reset: () => void
}

const initialState = {
  guestUuid: '',
  displayName: '',
  participantId: '',
  myParticipant: null,
  room: null,
  participants: [],
  round: null,
  questions: [],
  roundFinished: null,
  animals: [],
  settings: DEFAULT_SETTINGS,
  scoreboard: [],
  reactions: [],
  timerEndsAt: null,
  ws: null,
  isConnected: false,
  pendingQuestionId: null,
  isMyTurn: false,
  isPlayer: false,
  isHost: false,
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  setSession: (session) => {
    set({
      guestUuid: session.guestUuid,
      displayName: session.displayName || '',
      participantId: session.participantId || '',
    })
    saveSession({
      guestUuid: session.guestUuid,
      displayName: session.displayName || '',
      participantId: session.participantId || '',
      roomCode: session.roomCode || '',
    })
  },

  setRoom: (room) => {
    set({
      room,
      participants: room.participants,
    })
  },

  setParticipants: (participants) => {
    const { participantId } = get()
    const myP = participants.find(p => p.id === participantId) || null
    // Update scoreboard from participants list
    const scoreboard = [...participants]
      .sort((a, b) => b.score - a.score)
      .map(p => ({ participant_id: p.id, display_name: p.display_name, score: p.score }))
    set({
      participants,
      myParticipant: myP,
      isHost: myP?.role === 'host',
      isPlayer: myP?.role === 'player' || myP?.role === 'host',
      scoreboard,
    })
  },

  setRound: (round) => {
    const { participantId } = get()
    const isMyTurn = round?.current_turn_player_id === participantId
    const myRole = round?.my_role_in_round
    // Restore timer from round data (reconnect path)
    const timerEndsAt = round?.timer_ends_at || null
    set({
      round,
      isMyTurn,
      isPlayer: myRole === 'player1' || myRole === 'player2',
      roundFinished: round ? null : get().roundFinished,
      timerEndsAt,
    })
  },

  setQuestions: (questions) => {
    const pending = questions.find(q => q.answer === 'pending')
    set({ questions, pendingQuestionId: pending?.id || null })
  },

  addQuestion: (question) => {
    const questions = [...get().questions, question]
    const pending = questions.find(q => q.answer === 'pending')
    set({ questions, pendingQuestionId: pending?.id || null })
  },

  updateQuestion: (questionId, updates) => {
    const questions = get().questions.map(q =>
      q.id === questionId ? { ...q, ...updates } : q
    )
    const pending = questions.find(q => q.answer === 'pending')
    set({ questions, pendingQuestionId: pending?.id || null })
  },

  setAnimals: (animals) => set({ animals }),

  setRoundFinished: (data) => {
    set({
      roundFinished: data,
      round: data ? { ...get().round!, status: 'finished' } : get().round,
      timerEndsAt: null,
    })
    if (data?.scoreboard) {
      set({ scoreboard: data.scoreboard })
    }
  },

  setPendingQuestionId: (id) => set({ pendingQuestionId: id }),

  setSettings: (settings) => set({ settings: { ...get().settings, ...settings } }),

  setScoreboard: (scoreboard) => set({ scoreboard }),

  addReaction: (reaction) => {
    set({ reactions: [...get().reactions, reaction] })
  },

  removeReaction: (id) => {
    set({ reactions: get().reactions.filter(r => r.id !== id) })
  },

  setTimerEndsAt: (ts) => set({ timerEndsAt: ts }),

  connectWs: (roomCode, participantId) => {
    const existing = get().ws
    if (existing) existing.disconnect()
    const ws = new GameWebSocket(roomCode, participantId)
    ws.onConnectionChange = (connected) => set({ isConnected: connected })
    ws.on((event) => get().handleWsEvent(event))
    ws.connect()
    set({ ws, isConnected: false })
  },

  disconnectWs: () => {
    get().ws?.disconnect()
    set({ ws: null, isConnected: false })
  },

  handleWsEvent: (event) => {
    const { participantId, setParticipants, setRound, addQuestion, updateQuestion, setRoundFinished } = get()

    switch (event.type) {
      case 'state_sync': {
        const data = event.data as {
          room_code: string
          room_status: string
          participants: Participant[]
          host_participant_id: string
          round?: Round
          questions?: Question[]
          settings?: Partial<GameSettings>
          scoreboard?: ScoreboardEntry[]
        }
        setParticipants(data.participants)
        if (data.round) setRound(data.round)
        if (data.questions) {
          const pending = data.questions.find(q => q.answer === 'pending')
          set({ questions: data.questions, pendingQuestionId: pending?.id || null })
        }
        if (data.settings) {
          set({ settings: { ...DEFAULT_SETTINGS, ...data.settings } as GameSettings })
        }
        if (data.scoreboard) {
          set({ scoreboard: data.scoreboard })
        }
        if (get().room) {
          set({ room: { ...get().room!, status: data.room_status as any, participants: data.participants } })
        }
        break
      }

      case 'participant_joined':
      case 'participant_connected':
      case 'participant_left':
      case 'participant_disconnected': {
        const data = event.data as { all_participants?: Participant[]; participant?: Participant; participant_id?: string; display_name?: string }
        if (data.all_participants) {
          setParticipants(data.all_participants)
        } else if (event.type === 'participant_joined' && data.participant) {
          const updated = [...get().participants.filter(p => p.id !== data.participant!.id), data.participant]
          setParticipants(updated)
          toast.info(`انضم ${data.participant.display_name} إلى الغرفة 👋`)
        } else if (event.type === 'participant_left' || event.type === 'participant_disconnected') {
          const updated = get().participants.map(p =>
            p.id === data.participant_id ? { ...p, is_connected: false } : p
          )
          setParticipants(updated)
          if (event.type === 'participant_left' && data.display_name) {
            toast.warning(`غادر ${data.display_name} الغرفة`)
          }
        } else if (event.type === 'participant_connected') {
          const updated = get().participants.map(p =>
            p.id === data.participant_id ? { ...p, is_connected: true } : p
          )
          setParticipants(updated)
          const p = updated.find(p => p.id === data.participant_id)
          if (p) toast.success(`عاد ${p.display_name} إلى اللعبة 🟢`)
        }
        break
      }

      case 'participant_removed': {
        toast.error('تمت إزالتك من الغرفة بواسطة المدير.')
        setTimeout(() => { window.location.href = '/' }, 1000)
        break
      }

      case 'host_transferred': {
        const data = event.data as { new_host_id: string; new_host_name: string }
        toast.info(`أصبح ${data.new_host_name} مدير الغرفة 👑`)
        break
      }

      case 'room_closed': {
        toast.error('تم إغلاق الغرفة بواسطة المدير.')
        setTimeout(() => { window.location.href = '/' }, 1500)
        break
      }

      case 'round_cancelled': {
        toast.warning('تم إلغاء الجولة.')
        setRound(null)
        setRoundFinished(null)
        set({ timerEndsAt: null })
        if (get().room) set({ room: { ...get().room!, status: 'waiting' } })
        break
      }

      case 'round_started': {
        const round = event.data as Round
        setRound(round)
        set({ questions: [], roundFinished: null, pendingQuestionId: null })
        if (get().room) set({ room: { ...get().room!, status: 'playing' } })
        break
      }

      case 'question_submitted': {
        const data = event.data as { question: Question; current_turn_player_id: string }
        addQuestion(data.question)
        break
      }

      case 'answer_submitted': {
        const data = event.data as {
          question_id: string
          answer: string
          answerer_name: string
          is_valid: boolean
          current_turn_player_id: string | null
        }
        updateQuestion(data.question_id, { answer: data.answer as any, is_valid: data.is_valid })
        set({ pendingQuestionId: null })
        if (get().round) {
          setRound({ ...get().round!, current_turn_player_id: data.current_turn_player_id })
        }
        break
      }

      case 'wrong_guess': {
        const data = event.data as { current_turn_player_id: string; guesser_name: string; guessed_animal: Animal }
        if (get().round) setRound({ ...get().round!, current_turn_player_id: data.current_turn_player_id })
        break
      }

      case 'round_finished': {
        const data = event.data as RoundFinishedData
        setRoundFinished(data)
        set({ timerEndsAt: null })
        if (get().room) set({ room: { ...get().room!, status: 'waiting' } })
        break
      }

      case 'reaction': {
        const data = event.data as { emoji: string; participant_id: string; display_name: string; ts: number }
        const reaction: ReactionEvent = {
          id: `${data.participant_id}-${Date.now()}-${Math.random()}`,
          emoji: data.emoji,
          participant_id: data.participant_id,
          display_name: data.display_name,
          ts: data.ts,
        }
        get().addReaction(reaction)
        // Auto-remove after 3.5s
        setTimeout(() => get().removeReaction(reaction.id), 3500)
        break
      }

      case 'timer_started': {
        const data = event.data as { duration_seconds: number; ends_at: number }
        set({ timerEndsAt: data.ends_at })
        break
      }

      case 'game_settings_updated': {
        const data = event.data as { settings: Partial<GameSettings> }
        set({ settings: { ...get().settings, ...data.settings } as GameSettings })
        break
      }

      case 'scoreboard_updated': {
        const data = event.data as { scoreboard: any[] }
        set({ scoreboard: data.scoreboard })
        break
      }
    }
  },

  reset: () => {
    get().ws?.disconnect()
    set(initialState)
  },
}))
