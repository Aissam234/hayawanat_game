// Locally synthesized effects: no downloads, server traffic or microphone access.
type Sound = 'start' | 'question' | 'turn' | 'wrong' | 'finish'
const patterns: Record<Sound, number[]> = {
  start: [392, 523, 659], question: [660], turn: [523, 784],
  wrong: [220, 165], finish: [523, 659, 784, 1047],
}
let context: AudioContext | null = null
let muted = false
try { muted = localStorage.getItem('hayawanat_sound_muted') === '1' } catch { /* Storage may be unavailable. */ }
let recording = false
let last = 0
const active = new Set<OscillatorNode>()
export const soundsMuted = () => muted
export function stopSounds() {
  active.forEach(node => { try { node.stop() } catch { /* Already ended. */ } })
  active.clear()
}
export function muteSounds(value: boolean) {
  muted = value
  if (value) stopSounds()
  try { localStorage.setItem('hayawanat_sound_muted', value ? '1' : '0') } catch { /* Session preference still works. */ }
}
export function recordingSounds(value: boolean) { recording = value; if (value) stopSounds() }
export function unlockSounds() {
  if (muted || document.hidden) return
  try {
    const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return
    context ??= new Constructor()
    if (context.state === 'suspended') void context.resume().catch(() => {})
  } catch { /* Audio must never interrupt gameplay. */ }
}
export function playSound(sound: Sound) {
  if (muted || recording || document.hidden || !context || context.state !== 'running') return
  if (Array.from(document.querySelectorAll('audio')).some(audio => !audio.paused && !audio.ended)) return
  const now = performance.now()
  if (now - last < 180) return
  last = now
  try {
    stopSounds()
    patterns[sound].forEach((frequency, index) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain()
      const start = context!.currentTime + index * 0.12
      oscillator.type = 'sine'; oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.055, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16)
      oscillator.connect(gain); gain.connect(context!.destination)
      active.add(oscillator)
      oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
      oscillator.start(start); oscillator.stop(start + 0.17)
    })
  } catch { stopSounds() }
}
