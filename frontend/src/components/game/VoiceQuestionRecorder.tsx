import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AUDIO_MIME_TYPES, normalizeAudioMime, MAX_AUDIO_BYTES, MAX_RECORDING_MS, audioToBase64 } from '../../services/voiceAudio'
import { GameWebSocket } from '../../services/websocket'
import MicrophoneLevelIndicator from './MicrophoneLevelIndicator'

type Phase = 'idle' | 'recording' | 'preview' | 'sending' | 'sent'
interface Props { roundId: string; enabled: boolean; deadline: number | null; ws: GameWebSocket | null }

export default function VoiceQuestionRecorder({ roundId, enabled, deadline, ws }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [requesting, setRequesting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const recording = useRef<{ blob: Blob; duration: number; requestId: string } | null>(null)
  const previewUrl = useRef('')
  const generation = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const mounted = useRef(false)
  const current = useRef({ enabled, deadline, ws, roundId })
  current.current = { enabled, deadline, ws, roundId }
  const allowed = () => !document.hidden && current.current.enabled && current.current.ws?.isConnected &&
    (!current.current.deadline || Date.now() < current.current.deadline)

  function stopTracks() {
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop() })
    stream.current = null
  }
  function clearTimers() {
    timers.current.forEach(timer => clearTimeout(timer))
    timers.current = []
  }
  function discard() {
    generation.current++ // Invalidates late permission, data and send callbacks.
    clearTimers()
    const active = recorder.current
    recorder.current = null
    if (active) {
      active.ondataavailable = null; active.onstop = null; active.onerror = null
      if (active.state !== 'inactive') active.stop()
    }
    stopTracks()
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = ''
    recording.current = null
    stopRecording.current = () => {}
    if (mounted.current) { setPhase('idle'); setPreview(''); setElapsed(0); setRequesting(false) }
  }
  function interrupt(message: string) {
    discard()
    if (mounted.current) setError(message)
  }

  useEffect(() => {
    mounted.current = true
    const hide = () => { if (document.hidden && (recorder.current || stream.current)) interrupt('توقف التسجيل عند مغادرة الشاشة؛ سجّل السؤال مجدداً') }
    document.addEventListener('visibilitychange', hide)
    return () => { mounted.current = false; discard(); document.removeEventListener('visibilitychange', hide) }
  }, [])

  useEffect(() => {
    if (!enabled) interrupt('التسجيل متاح فقط أثناء دورك ومع اتصال نشط')
    if (!deadline) return
    const timer = setTimeout(() => interrupt('انتهى وقت الجولة؛ تم حذف التسجيل غير المرسل'), Math.max(0, deadline - Date.now()))
    return () => clearTimeout(timer)
  }, [enabled, deadline, roundId])

  async function start() {
    if (requesting || !allowed()) return
    discard(); setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('التسجيل غير مدعوم هنا. افتح الموقع عبر HTTPS أو استخدم سؤالاً كتابياً'); return
    }
    const mime = AUDIO_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type))
    if (!mime) { setError('متصفحك لا يدعم صيغة تسجيل مناسبة؛ استخدم سؤالاً كتابياً'); return }
    const token = generation.current
    setRequesting(true)
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (token !== generation.current || !mounted.current || !allowed()) {
        media.getTracks().forEach(track => track.stop()); return
      }
      stream.current = media
      media.getTracks().forEach(track => { track.onended = () => interrupt('انقطع الميكروفون؛ سجّل السؤال مجدداً') })
      const active = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 64000 })
      recorder.current = active
      const chunks: Blob[] = []
      let size = 0
      let duration = 0
      const started = performance.now()
      const stop = () => {
        if (token !== generation.current || active.state === 'inactive') return
        duration = performance.now() - started
        clearTimers()
        active.stop()
        stopTracks()
      }
      active.ondataavailable = event => {
        if (token !== generation.current) return
        size += event.data.size
        if (size > MAX_AUDIO_BYTES) { interrupt('التسجيل أكبر من 256 كيلوبايت؛ سجّل سؤالاً أقصر'); return }
        if (event.data.size) chunks.push(event.data)
      }
      active.onerror = () => interrupt('تعذّر إكمال التسجيل؛ حاول مرة أخرى')
      active.onstop = () => {
        if (token !== generation.current || !mounted.current) return
        clearTimers(); stopTracks(); recorder.current = null
        stopRecording.current = () => {}
        if (!allowed()) { interrupt('انتهى الدور أو انقطع الاتصال؛ تم حذف التسجيل'); return }
        if (!duration || duration > MAX_RECORDING_MS + 500) { interrupt('توقف التسجيل بشكل غير متوقع؛ حاول مرة أخرى'); return }
        const recordedMime = normalizeAudioMime(active.mimeType || chunks[0]?.type || mime)
        if (!recordedMime) { interrupt('صيغة التسجيل غير مدعومة؛ استخدم سؤالاً كتابياً'); return }
        const blob = new Blob(chunks, { type: recordedMime })
        chunks.length = 0
        if (!blob.size) { interrupt('التسجيل فارغ؛ تأكد من الميكروفون وحاول مرة أخرى'); return }
        recording.current = { blob, duration: Math.min(MAX_RECORDING_MS, Math.max(1, Math.round(duration))), requestId: crypto.randomUUID() }
        previewUrl.current = URL.createObjectURL(blob)
        setPreview(previewUrl.current); setElapsed(Math.min(12, Math.ceil(duration / 1000))); setPhase('preview')
      }
      // Keep stop accessible to the button without attaching extra event listeners.
      stopRecording.current = stop
      active.start(250)
      setPhase('recording'); setRequesting(false)
      timers.current.push(setTimeout(stop, MAX_RECORDING_MS))
      const tick = () => {
        if (token !== generation.current || active.state !== 'recording') return
        setElapsed(Math.min(12, Math.floor((performance.now() - started) / 1000)))
        timers.current.push(setTimeout(tick, 250))
      }
      tick()
    } catch (err) {
      if (token !== generation.current || !mounted.current) return
      const name = err instanceof DOMException ? err.name : ''
      interrupt(name === 'NotAllowedError' ? 'لم يُسمح باستخدام الميكروفون؛ يمكنك السماح به من إعدادات المتصفح أو كتابة السؤال'
        : name === 'NotFoundError' ? 'لم نعثر على ميكروفون؛ استخدم سؤالاً كتابياً'
        : 'الميكروفون غير متاح أو مشغول؛ حاول مرة أخرى أو اكتب السؤال')
    }
  }
  const stopRecording = useRef<() => void>(() => {})
  async function send() {
    const clip = recording.current
    if (!clip || phase !== 'preview' || !allowed() || !ws) return
    const token = generation.current
    setPhase('sending'); setError('')
    try {
      const audio_base64 = await audioToBase64(clip.blob)
      if (token !== generation.current || !allowed()) return
      await ws.sendVoiceQuestion({ round_id: roundId, request_id: clip.requestId, audio_base64,
        mime_type: clip.blob.type, duration_ms: clip.duration })
      if (token === generation.current && mounted.current) { discard(); setPhase('sent') }
    } catch (err) {
      if (token !== generation.current || !mounted.current) return
      setError(err instanceof Error ? err.message : 'تعذّر إرسال التسجيل')
      setPhase('preview') // Retry uses the same request ID, never a second question.
    }
  }
  const button = 'min-h-12 px-4 py-3 rounded-xl font-bold disabled:opacity-40 transition-colors'
  return <div className="space-y-3" dir="rtl" aria-label="مسجل السؤال الصوتي">
    <p className="text-xs text-game-text-muted">حتى 12 ثانية · استمع قبل الإرسال · التسجيل غير محفوظ بعد إعادة الاتصال</p>
    {phase === 'idle' && <button className={`${button} w-full bg-indigo-600 text-white`} disabled={!enabled || requesting} onClick={start}>
      {requesting ? 'بانتظار إذن الميكروفون…' : '🎤 بدء التسجيل'}
    </button>}
    {phase === 'recording' && <div className="space-y-3 text-center">
      <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-red-400">🔴 جارٍ التسجيل</motion.div>
      <p className="text-3xl font-mono tabular-nums text-game-text" dir="ltr" aria-label="مدة التسجيل">00:{String(elapsed).padStart(2, '0')} / 00:12</p>
      <MicrophoneLevelIndicator stream={stream.current} />
      <button className={`${button} w-full bg-red-500/20 text-red-300 border border-red-500/50`} onClick={() => stopRecording.current()}>⏹ إيقاف التسجيل</button>
    </div>}
    {(phase === 'preview' || phase === 'sending') && <>
      <p className="text-sm text-game-text">معاينة السؤال · {elapsed} ثوانٍ</p>
      <audio controls src={preview} aria-label="معاينة التسجيل" className="w-full h-12" />
      <div className="flex gap-2">
        <button className={`${button} flex-1 bg-indigo-600 text-white`} disabled={phase === 'sending' || !enabled} onClick={send}>{phase === 'sending' ? 'جارٍ الإرسال…' : '📤 إرسال التسجيل'}</button>
        <button className={`${button} bg-game-surface text-game-text`} disabled={phase === 'sending'} onClick={() => { discard(); setError('') }}>🗑️ حذف وإعادة التسجيل</button>
      </div>
    </>}
    {phase === 'sent' && <p role="status" className="text-emerald-400">✅ تم إرسال السؤال الصوتي</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </div>
}
