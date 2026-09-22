import { useEffect, useState } from 'react'
import { Music2, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react'
import { getMusicVolume, getEffectsVolume, setMusicVolume, setEffectsVolume, muteSounds, soundsMuted, muteClicks, clicksAreMuted, stopSounds, stopAllSounds, refreshMusic, playSound, unlockSounds } from '../../services/gameSounds'

export default function SoundControl() {
  const [musicMuted, setMusicMuted] = useState(soundsMuted)
  const [effectsMuted, setEffectsMuted] = useState(clicksAreMuted)
  const [expanded, setExpanded] = useState(false)
  const [musicLevel, setMusicLevel] = useState(getMusicVolume)
  const [effectsLevel, setEffectsLevel] = useState(getEffectsVolume)
  useEffect(() => {
    let disposed = false
    // Try on arrival; browsers that block autoplay resume from the next gesture.
    void unlockSounds()
    const hide = () => { if (document.hidden) stopAllSounds(); refreshMusic() }
    const media = (event: Event) => { if (event.target instanceof HTMLMediaElement) { if (event.type === 'play') stopSounds(); refreshMusic() } }
    const feedback = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target || target.closest('[data-sound-toggle], :disabled, [aria-disabled="true"], audio, video')) return
      const started = performance.now()
      void unlockSounds().then(() => {
        if (!disposed && performance.now() - started < 500) playSound('click')
      })
    }
    const pointer = (event: PointerEvent) => { if (event.isPrimary && event.button === 0) feedback(event) }
    const click = (event: MouseEvent) => {
      // Keyboard/assistive activation has no pointerdown; avoid double touch sounds.
      if (event.detail === 0) feedback(event)
    }
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('click', click, true)
    document.addEventListener('visibilitychange', hide)
    for (const type of ['play', 'pause', 'ended', 'emptied']) document.addEventListener(type, media, true)
    return () => {
      disposed = true
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('visibilitychange', hide)
      for (const type of ['play', 'pause', 'ended', 'emptied']) document.removeEventListener(type, media, true)
      stopAllSounds()
    }
  }, [])
  const button = 'flex items-center justify-center w-11 h-11 shrink-0 rounded-full border border-game-border bg-game-surface px-3 text-game-text shadow-lg text-xs'
  return <div className="fixed left-3 z-[60] flex gap-2" dir="rtl" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
    {expanded && <section id="sound-volume-panel" data-sound-toggle aria-label="مستويات الصوت" className="absolute bottom-full mb-2 left-0 w-64 max-w-[calc(100vw-24px)] rounded-2xl border border-game-border bg-game-surface p-4 shadow-xl space-y-4">
      <label className="block text-sm text-game-text">الموسيقى — {Math.round(musicLevel * 100)}%
        <input aria-label="مستوى الموسيقى" type="range" min="0" max="100" value={Math.round(musicLevel * 100)} onChange={e => { const value = Number(e.target.value) / 100; setMusicLevel(value); setMusicVolume(value) }} className="w-full h-11 accent-violet-500" />
      </label>
      <label className="block text-sm text-game-text">اللمس والمؤثرات — {Math.round(effectsLevel * 100)}%
        <input aria-label="مستوى المؤثرات" type="range" min="0" max="100" value={Math.round(effectsLevel * 100)} onChange={e => { const value = Number(e.target.value) / 100; setEffectsLevel(value); setEffectsVolume(value) }} onPointerUp={() => { void unlockSounds().then(() => playSound('click')) }} className="w-full h-11 accent-violet-500" />
      </label>
      <p className="text-xs text-game-text-muted">الكتم مستقل عن مستوى الصوت.</p>
    </section>}
    <button data-sound-toggle type="button" aria-label="إعدادات مستوى الصوت" aria-expanded={expanded} aria-controls="sound-volume-panel" onClick={() => setExpanded(!expanded)} className={button}><SlidersHorizontal size={18} /></button>
    <button data-sound-toggle type="button" aria-label={musicMuted ? 'تشغيل الموسيقى' : 'كتم الموسيقى'} aria-pressed={!musicMuted}
      onClick={() => { const next = !musicMuted; muteSounds(next); setMusicMuted(next); if (!next) void unlockSounds() }} className={button}>
      <span className="relative"><Music2 size={20} className={musicMuted ? 'opacity-40' : ''} />{musicMuted && <span aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t-2 border-current -rotate-45" />}</span>
    </button>
    <button data-sound-toggle type="button" aria-label={effectsMuted ? 'تشغيل أصوات اللمس والمؤثرات' : 'كتم أصوات اللمس والمؤثرات'} aria-pressed={!effectsMuted}
      onClick={() => { const next = !effectsMuted; muteClicks(next); setEffectsMuted(next); if (!next) void unlockSounds().then(() => playSound('click')) }} className={button}>
      {effectsMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  </div>
}
