import { motion, AnimatePresence } from 'framer-motion'
import { RoundFinishedData } from '../../types/game'
import { Trophy, Clock, HelpCircle, Target } from 'lucide-react'

interface Props {
  data: RoundFinishedData
  myId: string
  isHost: boolean
  onNewRound: () => void
  onBackToLobby: () => void
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return m > 0 ? `${m}د ${s}ث` : `${s} ثانية`
}

export default function VictoryScreen({ data, myId, isHost, onNewRound, onBackToLobby }: Props) {
  const iWon = data.winner_id === myId

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="glass-strong rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          {/* Trophy header */}
          <div className="relative bg-gradient-to-b from-yellow-500/20 to-transparent p-8 text-center border-b border-game-border">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 1, delay: 0.5 }}
              className="text-8xl mb-4"
            >
              🏆
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-black text-yellow-400 glow-gold"
            >
              {iWon ? 'أنت الفائز! 🎉' : `${data.winner_name} يفوز! 🎊`}
            </motion.h1>
          </div>

          {/* Animals reveal */}
          <div className="p-6 space-y-4">
            <p className="text-center text-game-text-muted text-sm mb-4">كشف الحيوانات السرية</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: data.player1_name, animal: data.player1_animal, isWinner: data.winner_id === data.player1_id },
                { name: data.player2_name, animal: data.player2_animal, isWinner: data.winner_id === data.player2_id },
              ].map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.2 }}
                  className={`text-center p-4 rounded-2xl border ${
                    p.isWinner
                      ? 'bg-yellow-500/10 border-yellow-500/50 glow-gold'
                      : 'bg-game-card border-game-border'
                  }`}
                >
                  {p.isWinner && <div className="text-lg mb-1">👑</div>}
                  <div className="text-5xl mb-2">{p.animal?.emoji || '❓'}</div>
                  <p className="text-sm font-bold text-game-text">{p.animal?.name_ar || '؟'}</p>
                  <p className="text-xs text-game-text-muted mt-1">{p.name}</p>
                </motion.div>
              ))}
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="grid grid-cols-3 gap-3 mt-4"
            >
              {[
                { icon: <HelpCircle size={18} />, label: 'أسئلة', value: data.question_count },
                { icon: <Target size={18} />, label: 'تخمينات', value: data.guess_count },
                { icon: <Clock size={18} />, label: 'المدة', value: formatDuration(data.started_at, data.finished_at) },
              ].map((stat, i) => (
                <div key={i} className="bg-game-card rounded-xl p-3 text-center border border-game-border">
                  <div className="text-game-text-muted flex justify-center mb-1">{stat.icon}</div>
                  <div className="text-xl font-black text-game-text">{stat.value}</div>
                  <div className="text-xs text-game-text-muted">{stat.label}</div>
                </div>
              ))}
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex gap-3 mt-4"
            >
              <button
                onClick={onBackToLobby}
                className="flex-1 py-3 rounded-xl border border-game-border text-game-text-muted hover:text-game-text hover:border-game-primary/50 transition-all font-semibold text-sm"
              >
                🔙 إعداد جولة جديدة
              </button>
              {isHost && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onNewRound}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-l from-indigo-600 to-violet-600 glow-primary transition-all text-sm flex items-center justify-center gap-2"
                >
                  🔄 إعادة اللعب بنفس اللاعبين
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
