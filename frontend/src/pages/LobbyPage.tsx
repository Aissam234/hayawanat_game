import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { api } from '../services/api'
import { GameSettings } from '../types/game'
import ParticipantList from '../components/lobby/ParticipantList'
import HostSettingsPanel from '../components/lobby/HostSettingsPanel'
import ConnectionStatus from '../components/shared/ConnectionStatus'
import Scoreboard from '../components/game/Scoreboard'
import { loadSession } from '../utils/session'
import { Copy, Check, Play, LogOut, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../components/ConfirmModal'
import { toast } from '../store/toastStore'

export default function LobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const {
    guestUuid, participantId, participants, room, isConnected, settings, scoreboard,
    setSession, setRoom, setParticipants, connectWs, reset, setSettings
  } = useGameStore()

  const [player1Id, setPlayer1Id] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [modalState, setModalState] = useState<{
    isOpen: boolean
    type: 'leave' | 'close' | 'remove' | 'transfer' | null
    targetId?: string
  }>({ isOpen: false, type: null })

  const myParticipant = participants.find(p => p.id === participantId)
  const isHost = myParticipant?.role === 'host'
  const hostId = room?.host_participant_id || null

  useEffect(() => {
    const init = async () => {
      let uuid = guestUuid
      let pId = participantId

      if (!uuid || !pId) {
        const session = loadSession()
        if (!session || session.roomCode !== roomCode || !session.guestUuid || !session.participantId) {
          navigate('/')
          return
        }
        uuid = session.guestUuid
        pId = session.participantId
        setSession({ guestUuid: uuid, displayName: session.displayName, participantId: pId, roomCode: roomCode! })
      }

      try {
        const roomData = await api.getRoom(roomCode!)
        setRoom(roomData)
        setParticipants(roomData.participants)
        connectWs(roomCode!, pId)

        // Load current settings from server
        try {
          const settingsData = await api.getSettings(roomCode!)
          if (settingsData.settings) {
            setSettings(settingsData.settings)
          }
        } catch {
          // Non-critical — ignore
        }
      } catch {
        navigate('/')
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (room?.status === 'playing') {
      navigate(`/game/${roomCode}`)
    }
  }, [room?.status])

  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      if (state.round && state.room?.status === 'playing') {
        navigate(`/game/${roomCode}`)
      }
    })
    return unsub
  }, [])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode || '')
    setCopied(true)
    toast.success('تم نسخ رمز الغرفة ✓')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartRound = async () => {
    if (!player1Id || !player2Id) { setError('اختر لاعبين أولاً'); return }
    if (player1Id === player2Id) { setError('يجب اختيار لاعبين مختلفين'); return }
    setStarting(true); setError('')
    try {
      await api.startRound(roomCode!, player1Id, player2Id, settings.difficulty, guestUuid)
      navigate(`/game/${roomCode}`)
    } catch (e: any) {
      setError(e.message || 'خطأ في بدء الجولة')
      setStarting(false)
    }
  }

  const getModalProps = () => {
    const targetName = modalState.targetId
      ? participants.find(p => p.id === modalState.targetId)?.display_name
      : ''
    switch (modalState.type) {
      case 'leave':
        return {
          title: 'مغادرة الغرفة', message: 'هل تريد مغادرة الغرفة؟',
          confirmText: 'مغادرة', isDestructive: true,
          onConfirm: async () => { await api.leaveRoom(roomCode!, guestUuid); reset(); navigate('/') }
        }
      case 'close':
        return {
          title: 'إغلاق الغرفة', message: 'سيتم إنهاء الغرفة وإخراج جميع المشاركين. هل أنت متأكد؟',
          confirmText: 'إغلاق الغرفة', isDestructive: true,
          onConfirm: async () => { await api.closeRoom(roomCode!, guestUuid); reset(); navigate('/') }
        }
      case 'remove':
        return {
          title: 'إزالة من الغرفة', message: `هل تريد إزالة ${targetName} من الغرفة؟`,
          confirmText: 'إزالة', isDestructive: true,
          onConfirm: async () => { await api.removeParticipant(roomCode!, modalState.targetId!, guestUuid); setModalState({ isOpen: false, type: null }) }
        }
      case 'transfer':
        return {
          title: 'نقل الإدارة', message: `هل تريد تعيين ${targetName} مديراً للغرفة؟`,
          confirmText: 'تأكيد', isDestructive: false,
          onConfirm: async () => { await api.transferHost(roomCode!, modalState.targetId!, guestUuid); setModalState({ isOpen: false, type: null }) }
        }
      default:
        return { title: '', message: '', onConfirm: () => {} }
    }
  }

  return (
    <div className="min-h-screen bg-animated bg-dots p-4 pb-8">
      <ConnectionStatus isConnected={isConnected} />

      <ConfirmModal
        isOpen={modalState.isOpen}
        {...getModalProps()}
        onCancel={() => setModalState({ isOpen: false, type: null })}
      />

      <div className="max-w-lg mx-auto space-y-4">
        {/* Header Actions */}
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => setModalState({ isOpen: true, type: 'leave' })}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 bg-gray-800/50 hover:bg-gray-800 rounded-xl transition-colors"
          >
            <LogOut size={16} />
            مغادرة
          </button>
          {isHost && (
            <button
              onClick={() => setModalState({ isOpen: true, type: 'close' })}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 rounded-xl transition-colors"
            >
              <Trash2 size={16} />
              إغلاق الغرفة
            </button>
          )}
        </div>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center pb-2">
          <div className="text-5xl mb-3">🐾</div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-l from-indigo-400 to-violet-400 pb-2">
            غرفة الانتظار
          </h1>
        </motion.div>

        {/* Room code card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 border border-game-border text-center"
        >
          <p className="text-game-text-muted text-sm mb-2">كود الغرفة</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-l from-indigo-300 to-violet-300 tracking-widest font-mono pb-2">
              {roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-2 rounded-xl border border-game-border hover:border-game-primary transition-colors text-game-text-muted hover:text-game-primary"
            >
              {copied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
            </button>
          </div>
          <p className="text-game-text-muted text-xs mt-2">شارك الكود مع أصدقائك</p>
        </motion.div>

        {/* Participants */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5 border border-game-border"
        >
          <h2 className="text-base font-bold text-game-text mb-3 flex items-center gap-2">
            <span>👥</span> المشاركون ({participants.length})
          </h2>
          <ParticipantList
            participants={participants}
            hostId={hostId}
            myId={participantId}
            isHost={isHost}
            onRemoveParticipant={(id) => setModalState({ isOpen: true, type: 'remove', targetId: id })}
            onTransferHost={(id) => setModalState({ isOpen: true, type: 'transfer', targetId: id })}
          />
        </motion.div>

        {/* Scoreboard — shows after at least one round */}
        {scoreboard.some(e => e.score > 0) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Scoreboard scoreboard={scoreboard} myId={participantId} />
          </motion.div>
        )}

        {/* Host controls */}
        {isHost && participants.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {/* Player selection */}
            <div className="glass rounded-2xl p-5 border border-game-border space-y-4">
              <h2 className="text-base font-bold text-game-text flex items-center gap-2">
                <span>👑</span> اختيار اللاعبين
              </h2>
              <div className="space-y-3">
                {[
                  { label: 'اللاعب الأول', value: player1Id, set: setPlayer1Id },
                  { label: 'اللاعب الثاني', value: player2Id, set: setPlayer2Id },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="text-sm text-game-text-muted mb-1.5 block">{label}</label>
                    <select
                      value={value}
                      onChange={e => set(e.target.value)}
                      className="w-full bg-game-surface border border-game-border rounded-xl py-2.5 px-3 text-game-text focus:border-game-primary transition-colors"
                    >
                      <option value="">— اختر لاعباً —</option>
                      {participants.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.display_name} {p.role === 'host' ? '👑' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings panel */}
            <HostSettingsPanel
              roomCode={roomCode!}
              guestUuid={guestUuid}
              settings={settings}
              onSettingsChange={setSettings}
            />

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                ⚠️ {error}
              </p>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={starting || !player1Id || !player2Id}
              onClick={handleStartRound}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 glow-success transition-all flex items-center justify-center gap-2"
            >
              <Play size={20} />
              {starting ? 'جاري البدء…' : 'ابدأ الجولة!'}
            </motion.button>
          </motion.div>
        )}

        {!isHost && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-5 border border-game-border text-center"
          >
            <div className="waiting-dots mb-3 flex justify-center gap-1">
              <span /><span /><span />
            </div>
            <p className="text-game-text-muted">بانتظار المدير لبدء الجولة…</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
