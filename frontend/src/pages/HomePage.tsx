import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { api } from '../services/api'
import { getOrCreateGuestUuid, saveSession, loadSession } from '../utils/session'
import { LogOut } from 'lucide-react'
import AuthModal from '../components/auth/AuthModal'

type Mode = 'home' | 'create' | 'join'

const animals = ['🦁', '🐯', '🐻', '🦊', '🐼', '🦋', '🦒', '🐬', '🦅', '🐊']

export default function HomePage() {
  const navigate = useNavigate()
  const { setSession } = useGameStore()
  const { user, logout } = useAuthStore()
  const [showAuth, setShowAuth] = useState(false)
  const closeAuth = useCallback(() => setShowAuth(false), [])
  const invite = new URLSearchParams(window.location.search).get('join')?.toUpperCase() || ''
  const validInvite = /^[A-Z2-9]{5}$/.test(invite) ? invite : ''
  const [mode, setMode] = useState<Mode>(validInvite ? 'join' : 'home')
  const [displayName, setDisplayName] = useState('')
  const [roomCode, setRoomCode] = useState(validInvite)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [floatingAnimals] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      emoji: animals[i % animals.length],
      x: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 4,
    }))
  )

  // Load saved name
  useEffect(() => {
    const session = loadSession()
    if (session) {
      if (session.displayName) setDisplayName(session.displayName)
    } else if (user) {
      setDisplayName(user.display_name || user.username)
    }
  }, [user])

  const handleCreate = async () => {
    if (!displayName.trim()) { setError('أدخل اسمك أولاً'); return }
    setLoading(true); setError('')
    try {
      const guestUuid = getOrCreateGuestUuid()
      const { room, participant } = await api.createRoom(displayName.trim(), guestUuid)
      setSession({ guestUuid, displayName: displayName.trim(), participantId: participant.id, roomCode: room.code })
      saveSession({ guestUuid, displayName: displayName.trim(), participantId: participant.id, roomCode: room.code })
      navigate(`/lobby/${room.code}`)
    } catch (e: any) {
      setError(e.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!displayName.trim()) { setError('أدخل اسمك أولاً'); return }
    if (!roomCode.trim()) { setError('أدخل كود الغرفة'); return }
    setLoading(true); setError('')
    try {
      const guestUuid = getOrCreateGuestUuid()
      const code = roomCode.trim().toUpperCase()
      const { room, participant } = await api.joinRoom(code, displayName.trim(), guestUuid)
      setSession({ guestUuid, displayName: displayName.trim(), participantId: participant.id, roomCode: room.code })
      saveSession({ guestUuid, displayName: displayName.trim(), participantId: participant.id, roomCode: room.code })
      navigate(`/lobby/${room.code}`)
    } catch (e: any) {
      setError(e.message || 'الغرفة غير موجودة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-animated bg-dots flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {user && (
        <div className="absolute top-4 right-4 glass px-4 py-2 rounded-2xl border border-game-border flex items-center gap-3 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-inner">
              {(user.display_name || user.username).charAt(0).toUpperCase()}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-game-text">{user.display_name || user.username}</div>
              <div className="text-xs text-game-text-muted">🐾 {user.total_score} نقاط</div>
            </div>
          </div>
          <button onClick={logout} className="p-2 text-game-text-muted hover:text-red-400 transition-colors" title="تسجيل الخروج">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating animal emojis */}
      {floatingAnimals.map((a, i) => (
        <motion.div
          key={i}
          className="fixed text-4xl pointer-events-none select-none opacity-10"
          style={{ left: `${a.x}%` }}
          animate={{ y: ['-100vh', '110vh'] }}
          transition={{ duration: a.duration, delay: a.delay, repeat: Infinity, ease: 'linear' }}
        >
          {a.emoji}
        </motion.div>
      ))}

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="text-center mb-10"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-7xl mb-4 filter drop-shadow-2xl"
        >
          🐾
        </motion.div>
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-l from-indigo-400 via-violet-400 to-purple-400 mb-2 pb-2">
          لعبة الحيوانات
        </h1>
        <p className="text-game-text-muted text-lg font-medium">
          اكتشف حيوانك قبل خصمك! 🎯
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="glass rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-game-border/60"
      >
        <AnimatePresence mode="wait">
          {mode === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setMode('create')}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 glow-primary transition-all"
              >
                ✨ إنشاء غرفة
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setMode('join')}
                className="w-full py-4 rounded-2xl font-bold text-game-text text-lg border-2 border-game-primary/50 hover:border-game-primary hover:bg-game-primary/10 transition-all"
              >
                🚪 الانضمام إلى غرفة
              </motion.button>
            </motion.div>
          )}

          {(mode === 'create' || mode === 'join') && (
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <button
                onClick={() => { setMode('home'); setError('') }}
                className="text-game-text-muted text-sm flex items-center gap-1 hover:text-game-text transition-colors"
              >
                ← رجوع
              </button>

              <h2 className="text-xl font-bold text-game-text">
                {mode === 'create' ? '✨ إنشاء غرفة جديدة' : '🚪 الانضمام إلى غرفة'}
              </h2>

              <div>
                <label className="text-sm text-game-text-muted mb-1.5 block">اسمك</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="أدخل اسمك…"
                  maxLength={20}
                  className="w-full bg-game-surface border border-game-border rounded-xl py-3 px-4 text-game-text placeholder-game-text-muted focus:border-game-primary transition-colors"
                  onKeyDown={e => e.key === 'Enter' && (mode === 'join' ? handleJoin() : handleCreate())}
                />
              </div>

              {mode === 'join' && (
                <div>
                  <label className="text-sm text-game-text-muted mb-1.5 block">كود الغرفة</label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="مثال: K7F4Q"
                    maxLength={10}
                    className="w-full bg-game-surface border border-game-border rounded-xl py-3 px-4 text-game-text placeholder-game-text-muted focus:border-game-primary transition-colors font-mono text-xl tracking-widest text-center uppercase"
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  />
                </div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2"
                >
                  ⚠️ {error}
                </motion.p>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                onClick={mode === 'create' ? handleCreate : handleJoin}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed glow-primary transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    جاري التحميل…
                  </span>
                ) : mode === 'create' ? '🎮 إنشاء وبدء' : '🚀 انضمام'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex gap-6 mt-8 text-center"
      >
        {[
          { icon: '🌐', label: 'أونلاين' },
          { icon: '⚡', label: 'Real-Time' },
          { icon: '👥', label: 'جماعية' },
        ].map(f => (
          <div key={f.label} className="text-game-text-muted text-sm">
            <div className="text-2xl mb-1">{f.icon}</div>
            <div>{f.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
