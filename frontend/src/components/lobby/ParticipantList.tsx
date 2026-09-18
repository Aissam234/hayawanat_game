import { motion } from 'framer-motion'
import { Participant } from '../../types/game'
import { Crown, User, Eye, UserMinus, Shield } from 'lucide-react'

interface Props {
  participants: Participant[]
  hostId?: string | null
  currentTurnId?: string | null
  myId?: string
  isHost?: boolean
  onRemoveParticipant?: (id: string) => void
  onTransferHost?: (id: string) => void
}

const roleIcon: Record<string, React.ReactNode> = {
  host: <Crown size={14} className="text-yellow-400" />,
  player: <User size={14} className="text-indigo-400" />,
  audience: <Eye size={14} className="text-slate-400" />,
}

const roleLabel: Record<string, string> = {
  host: 'المدير',
  player: 'لاعب',
  audience: 'جمهور',
}

export default function ParticipantList({ 
  participants, hostId, currentTurnId, myId, isHost, onRemoveParticipant, onTransferHost 
}: Props) {
  return (
    <div className="space-y-2">
      {participants.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
            p.id === currentTurnId
              ? 'bg-indigo-500/20 border-indigo-500/50 glow-primary'
              : p.id === myId
              ? 'bg-indigo-500/10 border-indigo-500/30'
              : 'bg-game-card border-game-border'
          }`}
        >
          {/* Connection dot */}
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              p.is_connected ? 'bg-emerald-400' : 'bg-red-500'
            }`}
            title={p.is_connected ? 'متصل' : 'غير متصل'}
          />

          {/* Role icon */}
          {roleIcon[p.role] || <User size={14} />}

          {/* Name */}
          <div className="flex-1 flex flex-col">
            <span className="font-semibold text-game-text text-sm flex items-center gap-2">
              {p.display_name}
              {p.id === myId && <span className="text-game-text-muted text-xs">(أنت)</span>}
              {!p.is_connected && <span className="text-red-400 text-[10px]">غير متصل</span>}
            </span>
          </div>

          {/* Actions for Host */}
          {isHost && p.id !== myId && (
            <div className="flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity absolute left-4 bg-game-card/90 backdrop-blur px-2 py-1 rounded-lg">
              <button
                onClick={() => onTransferHost?.(p.id)}
                className="p-1.5 text-game-text-muted hover:text-yellow-400 bg-game-surface hover:bg-game-surface/80 rounded-md transition-colors tooltip-trigger"
                title="تعيين كمدير"
              >
                <Shield size={14} />
              </button>
              <button
                onClick={() => onRemoveParticipant?.(p.id)}
                className="p-1.5 text-game-text-muted hover:text-red-400 bg-game-surface hover:bg-game-surface/80 rounded-md transition-colors tooltip-trigger"
                title="إزالة من الغرفة"
              >
                <UserMinus size={14} />
              </button>
            </div>
          )}

          {/* Role badge */}
          <span className="text-xs text-game-text-muted bg-game-surface px-2 py-0.5 rounded-full z-10">
            {roleLabel[p.role] || p.role}
          </span>
        </motion.div>
      ))}

      {participants.length === 0 && (
        <div className="text-center text-game-text-muted py-8">
          <div className="text-4xl mb-2">👥</div>
          <p>لا يوجد مشاركون بعد</p>
        </div>
      )}
    </div>
  )
}
