import { GuestSession } from '../types/game'

const STORAGE_KEY = 'hayawanat_session'

export function generateUUID(): string {
  return crypto.randomUUID()
}

export function getOrCreateGuestUuid(): string {
  const stored = localStorage.getItem('hayawanat_guest_uuid')
  if (stored) return stored
  const uuid = generateUUID()
  localStorage.setItem('hayawanat_guest_uuid', uuid)
  return uuid
}

export function saveSession(session: GuestSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession(): GuestSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GuestSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function clearRoomSession(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const session = JSON.parse(raw) as GuestSession
    // Keep guestUuid and displayName, clear room-specific data
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...session,
      participantId: '',
      roomCode: '',
    }))
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}
