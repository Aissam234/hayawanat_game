export class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }

const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as any,
  }

  // Attach token if present
  try {
    const authStorage = localStorage.getItem('auth_storage')
    if (authStorage) {
      const state = JSON.parse(authStorage).state
      if (state && state.token) {
        headers['Authorization'] = `Bearer ${state.token}`
      }
    }
  } catch (e) {
    // Ignore parse errors
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'خطأ في الشبكة' }))
    throw new ApiError(typeof err.detail === 'string' ? err.detail : 'تحقق من البيانات المدخلة', res.status)
  }

  return res.json()
}

// Auth endpoints
export const authApi = {
  login: (data: { username: string; password: string }) => request<{ access_token: string; user: import('../store/authStore').User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { username: string; password: string }) => request<{ access_token: string; user: import('../store/authStore').User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request<any>('/api/auth/me'),
}

// Rooms
export const api = {
  createRoom: (displayName: string, guestUuid: string) =>
    request<{ room: import('../types/game').Room; participant: import('../types/game').Participant }>('/api/rooms/', {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName, guest_uuid: guestUuid }),
    }),

  joinRoom: (roomCode: string, displayName: string, guestUuid: string) =>
    request<{ room: import('../types/game').Room; participant: import('../types/game').Participant }>(`/api/rooms/${roomCode}/join`, {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName, guest_uuid: guestUuid, room_code: roomCode }),
    }),

  getRoom: (roomCode: string) =>
    request<import('../types/game').Room>(`/api/rooms/${roomCode}`),

  leaveRoom: (roomCode: string, guestUuid: string) =>
    request<{ message: string }>(`/api/rooms/${roomCode}/leave?guest_uuid=${guestUuid}`, {
      method: 'DELETE',
    }),

  removeParticipant: (roomCode: string, targetId: string, guestUuid: string) =>
    request<{ message: string }>(`/api/rooms/${roomCode}/remove-participant?guest_uuid=${guestUuid}&target_id=${targetId}`, {
      method: 'POST',
    }),

  transferHost: (roomCode: string, targetId: string, guestUuid: string) =>
    request<{ message: string }>(`/api/rooms/${roomCode}/transfer-host?guest_uuid=${guestUuid}&target_id=${targetId}`, {
      method: 'POST',
    }),

  closeRoom: (roomCode: string, guestUuid: string) =>
    request<{ message: string }>(`/api/rooms/${roomCode}/close?guest_uuid=${guestUuid}`, {
      method: 'POST',
    }),

  // Rounds
  startRound: (roomCode: string, player1Id: string, player2Id: string, difficulty: string, guestUuid: string, bestOf: 1 | 3 = 1) =>
    request<{ message: string; round_id: string }>(`/api/rounds/${roomCode}/new-round?guest_uuid=${guestUuid}`, {
      method: 'POST',
      body: JSON.stringify({ player1_id: player1Id, player2_id: player2Id, difficulty, best_of: bestOf }),
    }),

  cancelRound: (roomCode: string, guestUuid: string) =>
    request<{ message: string }>(`/api/rounds/${roomCode}/cancel?guest_uuid=${guestUuid}`, {
      method: 'POST',
    }),

  rematch: (roomCode: string, guestUuid: string) =>
    request<{ message: string; round_id: string }>(`/api/rounds/${roomCode}/rematch?guest_uuid=${guestUuid}`, {
      method: 'POST',
    }),

  getCurrentRound: (roomCode: string, guestUuid: string) =>
    request<{ round: import('../types/game').Round | null }>(`/api/rounds/${roomCode}/current?guest_uuid=${guestUuid}`),

  getQuestions: (roomCode: string, guestUuid: string) =>
    request<{ questions: import('../types/game').Question[] }>(`/api/rounds/${roomCode}/questions?guest_uuid=${guestUuid}`),

  getAnimals: () =>
    request<{ animals: import('../types/game').Animal[] }>('/api/animals/list'),

  // Questions
  submitQuestion: (roomCode: string, questionText: string, guestUuid: string) =>
    request<{ question: import('../types/game').Question }>(`/api/questions/${roomCode}/submit?guest_uuid=${guestUuid}`, {
      method: 'POST',
      body: JSON.stringify({ question_text: questionText }),
    }),

  answerQuestion: (questionId: string, roomCode: string, answer: string, guestUuid: string) =>
    request<{ answer: unknown; current_turn_player_id: string | null }>(`/api/questions/${questionId}/answer?room_code=${roomCode}&guest_uuid=${guestUuid}`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),

  // Guesses
  submitGuess: (roomCode: string, animalId: number, guestUuid: string) =>
    request<{ is_correct: boolean; round_finished: boolean; current_turn_player_id?: string | null }>(`/api/guesses/${roomCode}/submit?guest_uuid=${guestUuid}`, {
      method: 'POST',
      body: JSON.stringify({ animal_id: animalId }),
    }),

  // Settings
  updateSettings: (roomCode: string, settings: {
    difficulty?: string
    timer_duration?: number | null
    max_questions?: number | null
    allow_repeated?: boolean
    reactions_enabled?: boolean
  }, guestUuid: string) =>
    request<{ settings: import('../types/game').GameSettings }>(
      `/api/rooms/${roomCode}/settings?guest_uuid=${guestUuid}`,
      {
        method: 'POST',
        body: JSON.stringify(settings),
      }
    ),

  getSettings: (roomCode: string) =>
    request<{ settings: import('../types/game').GameSettings }>(
      `/api/rooms/${roomCode}/settings`
    ),
}
