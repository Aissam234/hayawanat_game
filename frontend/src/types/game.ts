// === Game Types ===

export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type ParticipantRole = 'host' | 'player' | 'audience'
export type RoundStatus = 'active' | 'finished'
export type QuestionAnswer = 'pending' | 'yes' | 'no' | 'invalid'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'random'

export interface Animal {
  id: number
  name_ar: string
  emoji: string
  difficulty: string
}

export interface Participant {
  id: string
  display_name: string
  role: ParticipantRole
  is_connected: boolean
}

export interface Room {
  id: string
  code: string
  status: RoomStatus
  host_participant_id: string | null
  participants: Participant[]
}

export interface Round {
  id: string
  round_number: number
  player1_id: string
  player1_name: string
  player2_id: string
  player2_name: string
  current_turn_player_id: string | null
  status: RoundStatus
  difficulty: string
  question_count: number
  guess_count: number
  // Role-aware — only one of these sets is populated
  opponent_animal?: Animal          // for players
  my_role_in_round?: 'player1' | 'player2' | 'audience'
  player1_animal?: Animal           // for host/audience
  player2_animal?: Animal           // for host/audience
}

export interface Question {
  id: string
  asker_id: string
  asker_name: string
  question_text: string
  answer: QuestionAnswer
  is_valid: boolean
  created_at: string
}

export interface Guess {
  id?: string
  guesser_id?: string
  guesser_name: string
  animal_id?: number
  guessed_animal?: Animal
  is_correct: boolean
}

export interface RoundFinishedData {
  id: string
  winner_id: string | null
  winner_name: string | null
  player1_id: string
  player1_name: string
  player1_animal: Animal | null
  player2_id: string
  player2_name: string
  player2_animal: Animal | null
  question_count: number
  guess_count: number
  started_at: string | null
  finished_at: string | null
}

// === Session ===
export interface GuestSession {
  guestUuid: string
  displayName: string
  participantId: string
  roomCode: string
}

// === WebSocket Events ===
export type WsEventType =
  | 'state_sync'
  | 'participant_joined'
  | 'participant_left'
  | 'participant_connected'
  | 'participant_disconnected'
  | 'round_started'
  | 'round_cancelled'
  | 'question_submitted'
  | 'answer_submitted'
  | 'turn_changed'
  | 'guess_submitted'
  | 'wrong_guess'
  | 'round_finished'
  | 'new_round'
  | 'participant_removed'
  | 'host_transferred'
  | 'room_closed'
  | 'pong'

export interface WsEvent {
  type: WsEventType
  data?: unknown
}
