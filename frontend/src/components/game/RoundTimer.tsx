import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  timerEndsAt: number | null   // JS ms epoch from server
  durationSeconds: number | null
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function RoundTimer({ timerEndsAt, durationSeconds }: Props) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    if (!timerEndsAt) {
      setRemaining(0)
      return
    }
    const tick = () => {
      const now = Date.now()
      setRemaining(Math.max(0, timerEndsAt - now))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [timerEndsAt])

  if (!timerEndsAt || !durationSeconds) return null

  const totalMs = durationSeconds * 1000
  const pct = Math.min(1, remaining / totalMs)
  const isLow = remaining <= 10_000
  const isCritical = remaining <= 5_000
  const isDead = remaining <= 0

  const arcColor = isDead ? '#6b7280' : isLow ? '#ef4444' : '#6366f1'

  // SVG ring
  const r = 26
  const circ = 2 * Math.PI * r
  const dashOffset = circ * (1 - pct)

  return (
    <AnimatePresence>
      {timerEndsAt && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex flex-col items-center gap-1"
        >
          <motion.div
            animate={
              isCritical && !isDead
                ? { scale: [1, 1.12, 1] }
                : isLow && !isDead
                ? { scale: [1, 1.04, 1] }
                : {}
            }
            transition={
              isCritical ? { repeat: Infinity, duration: 0.6 }
              : isLow ? { repeat: Infinity, duration: 1 }
              : {}
            }
            className="relative"
          >
            {/* SVG ring */}
            <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
              {/* Track */}
              <circle
                cx="36" cy="36" r={r}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="5"
              />
              {/* Progress */}
              <motion.circle
                cx="36" cy="36" r={r}
                fill="none"
                stroke={arcColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circ}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 0.25, ease: 'linear' }}
              />
            </svg>
            {/* Text inside ring */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: 'none' }}
            >
              <span
                className={`font-black text-sm tabular-nums ${
                  isDead ? 'text-gray-500' :
                  isCritical ? 'text-red-400' :
                  isLow ? 'text-orange-400' : 'text-indigo-300'
                }`}
              >
                {formatTime(remaining)}
              </span>
            </div>
          </motion.div>

          <span
            className={`text-xs font-semibold ${
              isDead ? 'text-gray-500' :
              isCritical ? 'text-red-400 animate-pulse' :
              isLow ? 'text-orange-400' : 'text-game-text-muted'
            }`}
          >
            {isDead ? 'انتهى الوقت' : isCritical ? '⚡ يلا!' : '⏱️ الوقت'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
