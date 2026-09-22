import { createMusicLoop } from './backgroundMusic'
// Locally synthesized effects: no downloads, server traffic or microphone access.
import { synthesizeEffect, Sound } from './soundDesign'
function readVolume(key: string, fallback: number) {
  try { const raw = localStorage.getItem(key); const value = Number(raw); return raw !== null && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback } catch { return fallback }
}
let musicVolume = readVolume('hayawanat_music_volume', 0.45)
let effectsVolume = readVolume('hayawanat_effects_volume', 1)
export const getMusicVolume = () => musicVolume
export const getEffectsVolume = () => effectsVolume
export function setMusicVolume(value: number) {
  if (!Number.isFinite(value)) return
  musicVolume = Math.max(0, Math.min(1, value))
  if (musicGain && context) { musicGain.gain.cancelScheduledValues(context.currentTime); musicGain.gain.setTargetAtTime(musicVolume, context.currentTime, 0.04) }
  try { localStorage.setItem('hayawanat_music_volume', String(musicVolume)) } catch {}
}
export function setEffectsVolume(value: number) {
  if (!Number.isFinite(value)) return
  effectsVolume = Math.max(0, Math.min(1, value))
  if (!effectsVolume) stopSounds()
  try { localStorage.setItem('hayawanat_effects_volume', String(effectsVolume)) } catch {}
}
let context: AudioContext | null = null
let muted = false
let clicksMuted = false
try { muted = (localStorage.getItem('hayawanat_music_muted') ?? localStorage.getItem('hayawanat_sound_muted')) === '1'; clicksMuted = localStorage.getItem('hayawanat_clicks_muted') === '1' } catch { /* Storage may be unavailable. */ }
let musicBuffer: AudioBuffer | null = null
let music: AudioBufferSourceNode | null = null
let musicGain: GainNode | null = null
let musicStarted = 0
let musicOffset = 0
let mediaPlaying = false
function stopMusic() {
  if (music && context && musicBuffer) {
    musicOffset = (musicOffset + context.currentTime - musicStarted) % musicBuffer.duration
    try { music.stop() } catch { /* Already stopped. */ }
    music.disconnect(); musicGain?.disconnect()
  }
  music = null; musicGain = null
}
export function refreshMusic() {
  mediaPlaying = Array.from(document.querySelectorAll('audio, video')).some(audio => {
    const media = audio as HTMLMediaElement
    return !media.paused && !media.ended
  })
  if (muted || recording || document.hidden || mediaPlaying || context?.state !== 'running') {
    stopMusic(); return
  }
  if (music) return
  try {
    musicBuffer ??= createMusicLoop(context)
    music = context.createBufferSource(); musicGain = context.createGain()
    music.buffer = musicBuffer; music.loop = true
    musicGain.gain.setValueAtTime(0, context.currentTime)
    musicGain.gain.linearRampToValueAtTime(musicVolume, context.currentTime + 0.4)
    music.connect(musicGain); musicGain.connect(context.destination)
    musicStarted = context.currentTime; music.start(0, musicOffset)
  } catch { stopMusic() }
}
export function stopAllSounds() { stopSounds(); stopMusic() }
let recording = false
let last = 0
const active = new Set<OscillatorNode | AudioBufferSourceNode>()
export const soundsMuted = () => muted
export const clicksAreMuted = () => clicksMuted
export function muteClicks(value: boolean) {
  clicksMuted = value
  if (value) stopSounds()
  try { localStorage.setItem('hayawanat_clicks_muted', value ? '1' : '0') } catch {}
}
export function stopSounds() {
  active.forEach(node => { try { node.stop() } catch { /* Already ended. */ } })
  active.clear()
}
export function muteSounds(value: boolean) {
  muted = value
  if (value) stopMusic()
  else refreshMusic()
  try { localStorage.setItem('hayawanat_music_muted', value ? '1' : '0') } catch { /* Session preference still works. */ }
}
export function recordingSounds(value: boolean) { recording = value; if (value) stopSounds(); refreshMusic() }
export async function unlockSounds() {
  if (document.hidden) return
  try {
    const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return
    context ??= new Constructor()
    context.onstatechange = refreshMusic
    if (context.state !== 'running') await context.resume()
    refreshMusic()
  } catch { /* Audio must never interrupt gameplay. */ }
}
export function playSound(sound: Sound) {
  if (clicksMuted || !effectsVolume || recording || document.hidden || !context || context.state !== 'running') return
  if (Array.from(document.querySelectorAll('audio')).some(audio => !audio.paused && !audio.ended)) return
  const now = performance.now()
  if (sound !== 'click' && now - last < 180) return
  if (sound !== 'click') last = now
  try {
    if (sound !== 'click') stopSounds()
    synthesizeEffect(context, sound, node => {
      active.add(node)
      node.addEventListener('ended', () => active.delete(node), { once: true })
    }, effectsVolume)
  } catch { stopSounds() }
}
