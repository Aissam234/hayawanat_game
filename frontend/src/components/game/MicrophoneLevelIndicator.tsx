import { useEffect, useState } from 'react'

type Signal = 'listening' | 'quiet' | 'sound' | 'loud' | 'unavailable'
const labels: Record<Signal, string> = {
  listening: 'تحدث لرؤية مستوى صوتك',
  quiet: 'الصوت منخفض؛ اقترب من الميكروفون',
  sound: 'الميكروفون يلتقط الصوت',
  loud: 'الصوت مرتفع جداً؛ ابتعد قليلاً',
  unavailable: 'مؤشر الصوت غير متاح؛ يمكنك متابعة التسجيل',
}

export default function MicrophoneLevelIndicator({ stream }: { stream: MediaStream | null }) {
  const [reading, setReading] = useState<{ level: number; signal: Signal }>({ level: 0, signal: 'listening' })

  useEffect(() => {
    let disposed = false
    let context: AudioContext | undefined
    let source: MediaStreamAudioSourceNode | undefined
    let analyser: AnalyserNode | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    const unavailable = () => {
      if (!disposed) setReading({ level: 0, signal: 'unavailable' })
    }
    setReading({ level: 0, signal: 'listening' })
    try {
      const AudioContextClass = window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!stream || !AudioContextClass) {
        unavailable()
      } else {
        context = new AudioContextClass()
        source = context.createMediaStreamSource(stream)
        analyser = context.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        // Deliberately no connection to destination: never play the mic back.
        // Reuse the recorder's stream without requesting permission again.
        const samples = new Float32Array(analyser.fftSize)
        const started = performance.now()
        let lastSound = -Infinity
        let lastLoud = -Infinity
        let smoothed = 0
        timer = setInterval(() => {
          if (disposed || !context || !analyser) return
          if (context.state !== 'running') { unavailable(); return }
          analyser.getFloatTimeDomainData(samples)
          let squares = 0
          let peak = 0
          for (const sample of samples) {
            squares += sample * sample
            peak = Math.max(peak, Math.abs(sample))
          }
          const rms = Math.sqrt(squares / samples.length)
          // Relative input level, not calibrated loudness or speech detection.
          const db = 20 * Math.log10(Math.max(rms, 0.000001))
          const level = Math.max(0, Math.min(100, (db + 60) / 60 * 100))
          smoothed = Math.max(level, smoothed * 0.75)
          const now = performance.now()
          if (rms > 0.008) lastSound = now
          if (peak > 0.95) lastLoud = now
          const signal: Signal = now - lastLoud < 700 ? 'loud'
            : now - lastSound < 700 ? 'sound'
            : now - started < 1500 ? 'listening' : 'quiet'
          setReading({ level: Math.round(smoothed), signal })
        }, 100)
        void context.resume().catch(unavailable)
      }
    } catch {
      unavailable() // Meter support must never prevent recording a question.
    }
    return () => {
      disposed = true
      if (timer) clearInterval(timer)
      source?.disconnect()
      analyser?.disconnect()
      if (context && context.state !== 'closed') void context.close().catch(() => {})
      // The recorder owns/stops the microphone tracks.
    }
  }, [stream])

  const activeBars = Math.ceil(reading.level / 100 * 16)
  return <div className="rounded-xl border border-game-border bg-game-surface/60 px-4 py-3 space-y-2" dir="rtl">
    <p className="text-xs font-semibold text-game-text-muted">مستوى الميكروفون</p>
    {reading.signal !== 'unavailable' && <div role="meter" aria-label="مستوى الميكروفون"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={reading.level} aria-valuetext={labels[reading.signal]}
      className="flex h-7 items-end gap-1" dir="ltr">
      {Array.from({ length: 16 }, (_, index) => <span key={index} aria-hidden="true"
        className={`flex-1 rounded-sm transition-colors duration-100 motion-reduce:transition-none ${index < activeBars
          ? index >= 13 ? 'bg-amber-400' : 'bg-emerald-400'
          : 'bg-slate-700/60'}`}
        style={{ height: `${35 + index / 15 * 65}%` }} />)}
    </div>}
    <p role="status" aria-live="polite" className={`text-xs min-h-4 ${reading.signal === 'loud' ? 'text-amber-300'
      : reading.signal === 'sound' ? 'text-emerald-300' : 'text-game-text-muted'}`}>{labels[reading.signal]}</p>
  </div>
}
