import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { GameSettings, Difficulty } from '../../types/game'
import { api } from '../../services/api'
import { toast } from '../../store/toastStore'

interface Props {
  roomCode: string
  guestUuid: string
  settings: GameSettings
  onSettingsChange: (s: GameSettings) => void
}

const difficultyOptions: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy', label: '🐣 سهل', desc: 'حيوانات مألوفة' },
  { value: 'medium', label: '🦊 متوسط', desc: 'حيوانات متنوعة' },
  { value: 'hard', label: '🦎 صعب', desc: 'حيوانات نادرة' },
  { value: 'random', label: '🎲 عشوائي', desc: 'مفاجأة!' },
]

const timerOptions: { value: number | null; label: string }[] = [
  { value: null, label: 'بلا وقت' },
  { value: 60, label: '60 ثانية' },
  { value: 30, label: '30 ثانية' },
  { value: 20, label: '20 ثانية' },
  { value: 10, label: '10 ثوانٍ' },
]

const maxQOptions: { value: number | null; label: string }[] = [
  { value: null, label: 'بلا حد' },
  { value: 20, label: '20 سؤال' },
  { value: 15, label: '15 سؤال' },
  { value: 10, label: '10 أسئلة' },
  { value: 5, label: '5 أسئلة' },
]

export default function HostSettingsPanel({ roomCode, guestUuid, settings, onSettingsChange }: Props) {
  const [saving, setSaving] = useState(false)

  const save = useCallback(async (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch } as GameSettings
    onSettingsChange(next)
    setSaving(true)
    try {
      await api.updateSettings(roomCode, {
        difficulty: next.difficulty,
        timer_duration: next.timer_duration,
        max_questions: next.max_questions,
        allow_repeated: next.allow_repeated,
        reactions_enabled: next.reactions_enabled,
      }, guestUuid)
    } catch (e: any) {
      toast.error(e.message || 'فشل في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }, [settings, roomCode, guestUuid, onSettingsChange])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 border border-game-border space-y-5"
    >
      <h2 className="text-base font-bold text-game-text flex items-center gap-2">
        <span>⚙️</span> إعدادات الجولة
        {saving && <span className="text-xs text-game-text-muted animate-pulse mr-auto">جاري الحفظ…</span>}
      </h2>

      {/* Difficulty */}
      <div>
        <label className="text-sm text-game-text-muted mb-2 block">مستوى الصعوبة</label>
        <div className="grid grid-cols-2 gap-2">
          {difficultyOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => save({ difficulty: opt.value })}
              className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all text-right ${
                settings.difficulty === opt.value
                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                  : 'border-game-border text-game-text-muted hover:border-game-primary/50'
              }`}
            >
              <div>{opt.label}</div>
              <div className="text-xs font-normal mt-0.5 text-game-text-muted">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Timer */}
      <div>
        <label className="text-sm text-game-text-muted mb-2 block">⏱️ مؤقت الجولة</label>
        <div className="grid grid-cols-3 gap-2">
          {timerOptions.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => save({ timer_duration: opt.value })}
              className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                settings.timer_duration === opt.value
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'border-game-border text-game-text-muted hover:border-amber-500/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Max questions */}
      <div>
        <label className="text-sm text-game-text-muted mb-2 block">❓ الحد الأقصى للأسئلة</label>
        <div className="grid grid-cols-3 gap-2">
          {maxQOptions.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => save({ max_questions: opt.value })}
              className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                settings.max_questions === opt.value
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'border-game-border text-game-text-muted hover:border-violet-500/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle row: allow repeated + reactions */}
      <div className="grid grid-cols-2 gap-3">
        {/* Allow repeated animals */}
        <button
          onClick={() => save({ allow_repeated: !settings.allow_repeated })}
          className={`flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border text-xs font-semibold transition-all ${
            settings.allow_repeated
              ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
              : 'border-game-border text-game-text-muted'
          }`}
        >
          <span className="text-xl">{settings.allow_repeated ? '🔁' : '🚫'}</span>
          <span>تكرار الحيوانات</span>
          <span className="text-game-text-muted font-normal">{settings.allow_repeated ? 'مسموح' : 'ممنوع'}</span>
        </button>

        {/* Audience reactions */}
        <button
          onClick={() => save({ reactions_enabled: !settings.reactions_enabled })}
          className={`flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border text-xs font-semibold transition-all ${
            settings.reactions_enabled
              ? 'bg-pink-500/15 border-pink-500/60 text-pink-300'
              : 'border-game-border text-game-text-muted'
          }`}
        >
          <span className="text-xl">{settings.reactions_enabled ? '🎉' : '🔇'}</span>
          <span>تفاعلات الجمهور</span>
          <span className="text-game-text-muted font-normal">{settings.reactions_enabled ? 'مفعّلة' : 'معطّلة'}</span>
        </button>
      </div>
    </motion.div>
  )
}
