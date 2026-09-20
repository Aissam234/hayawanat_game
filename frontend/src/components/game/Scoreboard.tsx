import { motion, AnimatePresence } from 'framer-motion'
import { ScoreboardEntry } from '../../types/game'
import { Trophy } from 'lucide-react'

interface Props {
  scoreboard: ScoreboardEntry[]
  myId: string
  compact?: boolean
}

const medals = ['🥇', '🥈', '🥉']

export default function Scoreboard({ scoreboard, myId, compact = false }: Props) {
  if (scoreboard.length === 0) return null

  if (compact) {
    return (
      <div className="glass rounded-2xl border border-game-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-game-border flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" />
          <span className="text-xs font-bold text-game-text">لوحة النتائج</span>
        </div>
        <div className="p-2 space-y-1">
          {scoreboard.slice(0, 5).map((entry, i) => (
            <div
              key={entry.participant_id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${
                entry.participant_id === myId
                  ? 'bg-indigo-500/15 border border-indigo-500/30'
                  : ''
              }`}
            >
              <span className="text-xs w-5 text-center">
                {medals[i] || `${i + 1}`}
              </span>
              <span className={`flex-1 truncate ${
                entry.participant_id === myId ? 'text-indigo-300 font-semibold' : 'text-game-text-muted'
              }`}>
                {entry.display_name}
              </span>
              <span className="font-black text-game-text tabular-nums">{entry.score}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4 }}
      className="glass rounded-2xl border border-game-border overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-game-border flex items-center gap-2">
        <Trophy size={18} className="text-yellow-400" />
        <h3 className="font-bold text-game-text">لوحة النتائج</h3>
      </div>
      <div className="p-4 space-y-2">
        <AnimatePresence>
          {scoreboard.map((entry, i) => (
            <motion.div
              key={entry.participant_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                entry.participant_id === myId
                  ? 'bg-indigo-500/15 border border-indigo-500/40'
                  : 'bg-white/3 border border-transparent'
              }`}
            >
              <span className="text-lg w-6 text-center">
                {medals[i] || <span className="text-game-text-muted text-sm">{i + 1}</span>}
              </span>
              <span className={`flex-1 font-semibold ${
                entry.participant_id === myId ? 'text-indigo-300' : 'text-game-text'
              }`}>
                {entry.display_name}
                {entry.participant_id === myId && (
                  <span className="text-xs text-indigo-400 mr-1">(أنت)</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xl font-black text-game-text tabular-nums">
                  {entry.score}
                </span>
                <span className="text-xs text-game-text-muted">نقاط</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {scoreboard.length === 0 && (
          <p className="text-center text-game-text-muted text-sm py-2">لا توجد نقاط بعد</p>
        )}
      </div>
    </motion.div>
  )
}
