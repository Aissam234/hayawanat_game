import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { muteSounds, soundsMuted, stopSounds, unlockSounds } from '../../services/gameSounds'

export default function SoundControl() {
  const [muted, setMuted] = useState(soundsMuted)
  useEffect(() => {
    const hide = () => { if (document.hidden) stopSounds() }
    const media = (event: Event) => { if (event.target instanceof HTMLMediaElement) stopSounds() }
    document.addEventListener('pointerdown', unlockSounds)
    document.addEventListener('keydown', unlockSounds)
    document.addEventListener('visibilitychange', hide)
    document.addEventListener('play', media, true)
    return () => {
      document.removeEventListener('pointerdown', unlockSounds)
      document.removeEventListener('keydown', unlockSounds)
      document.removeEventListener('visibilitychange', hide)
      document.removeEventListener('play', media, true)
      stopSounds()
    }
  }, [])
  return <button type="button" aria-label={muted ? 'تشغيل المؤثرات الصوتية' : 'كتم المؤثرات الصوتية'} aria-pressed={!muted}
    title={muted ? 'تشغيل المؤثرات الصوتية' : 'كتم المؤثرات الصوتية'}
    onClick={() => { const next = !muted; muteSounds(next); setMuted(next); if (!next) unlockSounds() }}
    className="fixed left-3 z-40 rounded-full border border-game-border bg-game-surface p-3 text-game-text shadow-lg"
    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
    {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
  </button>
}
