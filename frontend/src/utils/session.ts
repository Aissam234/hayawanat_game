import { GuestSession } from '../types/game'

const STORAGE_KEY = 'hayawanat_session'

export function generateUUID(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  // LAN HTTP on phones lacks randomUUID, but still exposes getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
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
