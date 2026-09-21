import { useEffect, useState, useSyncExternalStore } from 'react'
import { Question } from '../../types/game'
import { getAudioUrl, subscribeAudio } from '../../services/voiceAudio'

export default function QuestionAudio({ question }: { question: Question }) {
  const url = useSyncExternalStore(subscribeAudio, () => getAudioUrl(question.id))
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  return <div className="min-w-0 w-full space-y-2" dir="rtl">
    <p className="text-sm text-game-text">🎤 سؤال صوتي · {Math.ceil((question.audio_duration_ms || 0) / 1000)} ثوانٍ</p>
    {url && !failed
      ? <audio aria-label={`سؤال صوتي من ${question.asker_name}`} className="w-full max-w-full h-11" controls preload="metadata" src={url} onError={() => setFailed(true)} />
      : <p className="text-xs text-game-text-muted">{failed ? 'تعذّر تشغيل التسجيل في هذا المتصفح' : 'التسجيل غير متوفر بعد إعادة الاتصال أو تفريغ الذاكرة'}</p>}
  </div>
}
