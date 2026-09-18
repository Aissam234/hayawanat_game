import { create } from 'zustand'
import {
  Room, Participant, Round, Question, Animal,
  RoundFinishedData, WsEvent, GuestSession
} from '../types/game'
import { GameWebSocket } from '../services/websocket'
import { saveSession, loadSession } from '../utils/session'
import { toast } from './toastStore'

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

  // WebSocket
  ws: GameWebSocket | null
  isConnected: boolean

  // UI State
  pendingQuestionId: string | null  // question awaiting answer
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
    const { guestUuid } = get()
    const myP = room.participants.find(p => {
      // Try matching by participantId first, then by guest in future
      return true // We'll set it separately
    })
    set({
      room,
      participants: room.participants,
    })
  },

  setParticipants: (participants) => {
    const { participantId } = get()
    const myP = participants.find(p => p.id === participantId) || null
    set({
      participants,
      myParticipant: myP,
      isHost: myP?.role === 'host',
      isPlayer: myP?.role === 'player' || myP?.role === 'host',
    })
  },

  setRound: (round) => {
    const { participantId } = get()
    const isMyTurn = round?.current_turn_player_id === participantId
    const myRole = round?.my_role_in_round
    set({
      round,
      isMyTurn,
      isPlayer: myRole === 'player1' || myRole === 'player2',
      roundFinished: round ? null : get().roundFinished,
    })
  },

  setQuestions: (questions) => {
    // Find if there's a pending question awaiting answer
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
    set({ roundFinished: data, round: data ? { ...get().round!, status: 'finished' } : get().round })
  },

  setPendingQuestionId: (id) => set({ pendingQuestionId: id }),

  connectWs: (roomCode, participantId) => {
    const existing = get().ws
    if (existing) {
      existing.disconnect()
    }

    const ws = new GameWebSocket(roomCode, participantId)
    ws.onConnectionChange = (connected) => {
      set({ isConnected: connected })
    }

    ws.on((event) => {
      get().handleWsEvent(event)
    })

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
        }
        setParticipants(data.participants)
        if (data.round) setRound(data.round)
        if (data.questions) {
          const pending = data.questions.find(q => q.answer === 'pending')
          set({ questions: data.questions, pendingQuestionId: pending?.id || null })
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
        setTimeout(() => {
          window.location.href = '/'
        }, 1000)
        break
      }

      case 'host_transferred': {
        const data = event.data as { new_host_id: string; new_host_name: string }
        toast.info(`أصبح ${data.new_host_name} مدير الغرفة 👑`)
        break
      }

      case 'room_closed': {
        toast.error('تم إغلاق الغرفة بواسطة المدير.')
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
        break
      }

      case 'round_cancelled': {
        toast.warning('تم إلغاء الجولة.')
        setRound(null)
        setRoundFinished(null)
        if (get().room) {
          set({ room: { ...get().room!, status: 'waiting' } })
        }
        break
      }

      case 'round_started': {
        const round = event.data as Round
        setRound(round)
        set({ questions: [], roundFinished: null, pendingQuestionId: null })
        if (get().room) {
          set({ room: { ...get().room!, status: 'playing' } })
        }
        break
      }

      case 'question_submitted': {
        const data = event.data as { question: Question; current_turn_player_id: string }
        addQuestion(data.question)
        // After submitting question — opponent needs to answer, turn doesn't change yet
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
          const newRound = {
            ...get().round!,
            current_turn_player_id: data.current_turn_player_id,
          }
          setRound(newRound)
        }
        break
      }

      case 'wrong_guess': {
        const data = event.data as { current_turn_player_id: string; guesser_name: string; guessed_animal: Animal }
        if (get().round) {
          setRound({ ...get().round!, current_turn_player_id: data.current_turn_player_id })
        }
        break
      }

      case 'round_finished': {
        const data = event.data as RoundFinishedData
        setRoundFinished(data)
        if (get().room) {
          set({ room: { ...get().room!, status: 'waiting' } })
        }
        break
      }
    }
  },

  reset: () => {
    get().ws?.disconnect()
    set(initialState)
  },
}))
