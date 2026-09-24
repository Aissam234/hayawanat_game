// === Game Types ===

export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type ParticipantRole = 'host' | 'player' | 'audience'
export type RoundStatus = 'active' | 'finished'
export type QuestionAnswer = 'pending' | 'yes' | 'no' | 'invalid'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'random'
export type EndReason = 'guess' | 'timer_expired' | 'cancelled'

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
  score: number
}

export interface Room {
  id: string
  code: string
  status: RoomStatus
  host_participant_id: string | null
  participants: Participant[]
}

export interface GameSettings {
  difficulty: Difficulty
  timer_duration: number | null   // seconds; null = no timer
  max_questions: number | null    // null = unlimited
  allow_repeated: boolean
  reactions_enabled: boolean
}

export interface ScoreboardEntry {
  participant_id: string
  display_name: string
  score: number
}

export interface ReactionEvent {
  id: string          // client-generated UUID for AnimatePresence key
  emoji: string
  participant_id: string
  display_name: string
  ts: number
}

export interface MatchSummary { id: string; best_of: number; target: number; player1_wins: number; player2_wins: number; champion_id: string | null; rounds_played: number }

export interface Round {
  match?: MatchSummary | null
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
  // Timer
  timer_duration?: number | null
  timer_started_at?: string | null
  timer_ends_at?: number | null     // JS ms epoch
  // Settings baked into round
  max_questions?: number | null
  reactions_enabled?: boolean
}

export interface Question {
  id: string
  asker_id: string
  asker_name: string
  question_text: string | null
  question_type: 'text' | 'audio'
  audio_duration_ms: number | null
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
  match?: MatchSummary | null
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
  end_reason: EndReason
  scoreboard: ScoreboardEntry[]
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
  | 'voice_question_accepted'
  | 'voice_question_error'
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
  | 'reaction'
  | 'timer_started'
  | 'timer_expired'
  | 'game_settings_updated'
  | 'scoreboard_updated'

export interface WsEvent {
  type: WsEventType
  data?: unknown
}
