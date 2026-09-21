// Transient, bounded playback cache. Never put base64/Blobs in Zustand/storage.
export const MAX_AUDIO_BYTES = 256 * 1024
export const MAX_RECORDING_MS = 12000
export const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus', 'audio/webm',
  'audio/ogg;codecs=opus', 'audio/ogg',
  'audio/mp4;codecs=mp4a.40.2', 'audio/mp4',
]
const cache = new Map<string, { url: string; size: number }>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())
export const subscribeAudio = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getAudioUrl = (id: string) => cache.get(id)?.url
export function clearVoiceAudio() {
  for (const value of cache.values()) URL.revokeObjectURL(value.url)
  cache.clear()
  notify()
}
export function receiveVoiceAudio(id: string, audio: { audio_base64: string; mime_type: string }) {
  if (cache.has(id)) return
  if (!AUDIO_MIME_TYPES.includes(audio.mime_type) || audio.audio_base64.length > 349528) return
  try {
    const decoded = atob(audio.audio_base64)
    if (!decoded.length || decoded.length > MAX_AUDIO_BYTES) return
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0))
    // At most 32 recordings / 8 MiB. Evicted questions keep their metadata.
    while (cache.size >= 32) {
      const oldest = cache.keys().next().value as string
      URL.revokeObjectURL(cache.get(oldest)!.url)
      cache.delete(oldest)
    }
    cache.set(id, { url: URL.createObjectURL(new Blob([bytes], { type: audio.mime_type })), size: bytes.length })
    notify()
  } catch { /* Invalid/unplayable media still has readable question metadata. */ }
}

export async function audioToBase64(blob: Blob) {
  if (!blob.size || blob.size > MAX_AUDIO_BYTES) throw new Error('التسجيل أكبر من الحد المسموح')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}
