import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { ReactionEvent } from '../../types/game'

const REACTIONS = ['😂', '🔥', '👏', '😱', '🤔', '❤️']

interface Props {
  enabled: boolean
  canReact: boolean  // false for active players
}

export default function ReactionBar({ enabled, canReact }: Props) {
  const { reactions, ws } = useGameStore()

  const sendReaction = (emoji: string) => {
    if (!enabled || !canReact || !ws) return
    ws.send({ type: 'reaction', data: { emoji } })
  }

  if (!enabled) return null

  return (
    <>
      {/* Floating reaction bubbles — full screen overlay, pointer-events-none */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {reactions.map((r) => (
            <FloatingReaction key={r.id} reaction={r} />
          ))}
        </AnimatePresence>
      </div>

      {/* Reaction buttons — shown at bottom only if canReact */}
      {canReact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-3 border border-game-border"
        >
          <p className="text-xs text-game-text-muted text-center mb-2">تفاعل مع الجمهور</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {REACTIONS.map((emoji) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => sendReaction(emoji)}
                className="text-2xl w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                aria-label={`Send ${emoji}`}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </>
  )
}

function FloatingReaction({ reaction }: { reaction: ReactionEvent }) {
  // Random horizontal position
  const left = 10 + Math.random() * 75 // 10% - 85%

  return (
    <motion.div
      className="absolute bottom-20 text-4xl select-none"
      style={{ left: `${left}%` }}
      initial={{ opacity: 1, y: 0, scale: 0.5 }}
      animate={{
        opacity: [1, 1, 0],
        y: [-60, -140, -220],
        scale: [0.8, 1.1, 0.9],
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 3, ease: 'easeOut' }}
    >
      {reaction.emoji}
    </motion.div>
  )
}
