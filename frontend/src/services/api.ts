const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'خطأ في الخادم' }))
    throw new Error(err.detail || 'حدث خطأ غير متوقع')
  }

  return res.json()
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
  startRound: (roomCode: string, player1Id: string, player2Id: string, difficulty: string, guestUuid: string) =>
    request<{ message: string; round_id: string }>(`/api/rounds/${roomCode}/new-round?guest_uuid=${guestUuid}`, {
      method: 'POST',
      body: JSON.stringify({ player1_id: player1Id, player2_id: player2Id, difficulty }),
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
  updateSettings: async (roomCode: string, settings: {
    difficulty?: string
    timer_duration?: number | null
    max_questions?: number | null
    allow_repeated?: boolean
    reactions_enabled?: boolean
  }, guestUuid: string) => {
    const res = await fetch(`/api/rooms/${roomCode}/settings?guest_uuid=${guestUuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'فشل في حفظ الإعدادات')
    }
    return res.json()
  },

  getSettings: async (roomCode: string) => {
    const res = await fetch(`/api/rooms/${roomCode}/settings`)
    if (!res.ok) throw new Error('فشل في جلب الإعدادات')
    return res.json()
  },
}
