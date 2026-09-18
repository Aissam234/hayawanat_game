import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { api } from '../services/api'
import { loadSession } from '../utils/session'
import { Animal, Question, Difficulty } from '../types/game'
import QuestionHistory from '../components/game/QuestionHistory'
import AnimalSelector from '../components/game/AnimalSelector'
import VictoryScreen from '../components/game/VictoryScreen'
import ConnectionStatus from '../components/shared/ConnectionStatus'
import { Send, Target, Eye, Ban, RotateCcw } from 'lucide-react'
import { ConfirmModal } from '../components/ConfirmModal'
import { toast } from '../store/toastStore'

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const {
    guestUuid, participantId, participants, round, questions,
    roundFinished, animals, isConnected, pendingQuestionId,
    setSession, setRoom, setParticipants, setRound, setQuestions, setAnimals,
    connectWs, setRoundFinished,
  } = useGameStore()

  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showAnimalSelector, setShowAnimalSelector] = useState(false)
  const [lastWrongGuess, setLastWrongGuess] = useState<{ name: string; animal: Animal } | null>(null)
  const [showNewRoundModal, setShowNewRoundModal] = useState(false)
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    type: 'cancel' | 'rematch' | null
  }>({ isOpen: false, type: null })
  const historyEndRef = useRef<HTMLDivElement>(null)

  // Derived state
  const myParticipant = participants.find(p => p.id === participantId)
  const isHost = myParticipant?.role === 'host'
  const myRoleInRound = round?.my_role_in_round
  const isPlayer = myRoleInRound === 'player1' || myRoleInRound === 'player2'
  const isMyTurn = round?.current_turn_player_id === participantId
  const currentTurnPlayer = participants.find(p => p.id === round?.current_turn_player_id)
  const pendingQuestion = questions.find(q => q.id === pendingQuestionId)
  const amAnswerer = pendingQuestion && pendingQuestion.asker_id !== participantId &&
    (round?.player1_id === participantId || round?.player2_id === participantId)

  // Init
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
        const [roomData, questionsData, roundData, animalsData] = await Promise.all([
          api.getRoom(roomCode!),
          api.getQuestions(roomCode!, uuid),
          api.getCurrentRound(roomCode!, uuid),
          animals.length === 0 ? api.getAnimals() : Promise.resolve({ animals }),
        ])
        setRoom(roomData)
        setParticipants(roomData.participants)
        if (questionsData.questions) setQuestions(questionsData.questions)
        if (roundData.round) setRound(roundData.round)
        if (animalsData.animals) setAnimals(animalsData.animals)
        connectWs(roomCode!, pId)
      } catch {
        navigate('/')
      }
    }
    init()
  }, [])

  // Track wrong guesses from WS
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prev) => {
      // Detect wrong_guess via turn change
    })
    return unsub
  }, [])

  // Auto-scroll question history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [questions.length])

  const handleSubmitQuestion = async () => {
    if (!questionText.trim() || submitting) return
    setSubmitting(true); setError('')
    try {
      await api.submitQuestion(roomCode!, questionText.trim(), guestUuid)
      setQuestionText('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnswer = async (answer: 'yes' | 'no' | 'invalid') => {
    if (!pendingQuestion) return
    setSubmitting(true)
    try {
      await api.answerQuestion(pendingQuestion.id, roomCode!, answer, guestUuid)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGuess = async (animal: Animal) => {
    setShowAnimalSelector(false)
    try {
      const result = await api.submitGuess(roomCode!, animal.id, guestUuid)
      if (!result.is_correct) {
        setLastWrongGuess({ name: myParticipant?.display_name || '', animal })
        setTimeout(() => setLastWrongGuess(null), 4000)
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleNewRound = async () => {
    try {
      await api.rematch(roomCode!, guestUuid)
      // The ws event 'round_started' will reset state
    } catch (e: any) {
      toast.error(e.message || 'فشل في بدء الجولة الجديدة')
    }
  }

  const handleBackToLobby = () => {
    setRoundFinished(null)
    navigate(`/lobby/${roomCode}`)
  }

  const getModalProps = () => {
    if (modalState.type === 'cancel') {
      return {
        title: 'إلغاء الجولة',
        message: 'هل تريد حقاً إلغاء الجولة الحالية؟',
        confirmText: 'إلغاء الجولة',
        isDestructive: true,
        onConfirm: async () => {
          try {
            await api.cancelRound(roomCode!, guestUuid)
            setModalState({ isOpen: false, type: null })
          } catch (e: any) {
            toast.error(e.message)
            setModalState({ isOpen: false, type: null })
          }
        }
      }
    }
    return { title: '', message: '', onConfirm: () => {} }
  }

  if (!round && !roundFinished) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center">
        <div className="text-center text-game-text-muted">
          <div className="text-6xl mb-4 animate-bounce">🐾</div>
          <p>جاري تحميل اللعبة…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-animated bg-dots pb-8">
      <ConnectionStatus isConnected={isConnected} />
      
      <ConfirmModal
        isOpen={modalState.isOpen}
        {...getModalProps()}
        onCancel={() => setModalState({ isOpen: false, type: null })}
      />

      {/* Victory screen */}
      {roundFinished && (
        <VictoryScreen
          data={roundFinished}
          myId={participantId}
          isHost={isHost}
          onNewRound={handleNewRound}
          onBackToLobby={handleBackToLobby}
        />
      )}

      {/* Animal Selector Modal */}
      {showAnimalSelector && (
        <AnimalSelector
          animals={animals}
          onSelect={handleGuess}
          onClose={() => setShowAnimalSelector(false)}
        />
      )}

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Header Actions */}
        {isHost && !roundFinished && (
          <div className="flex justify-end pt-2">
            <button 
              onClick={() => setModalState({ isOpen: true, type: 'cancel' })}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 rounded-xl transition-colors"
            >
              <Ban size={16} />
              إلغاء الجولة
            </button>
          </div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-game-text-muted">
            <span>🐾 لعبة الحيوانات</span>
            <span>·</span>
            <span>غرفة {roomCode}</span>
            <span>·</span>
            <span>جولة {round?.round_number}</span>
          </div>
        </motion.div>

        {/* My opponent's animal — role-aware */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-5 border border-game-border text-center"
        >
          {isPlayer && round?.opponent_animal ? (
            <>
              <p className="text-game-text-muted text-sm mb-2">حيوان خصمك</p>
              <div className="animal-emoji-lg">{round.opponent_animal.emoji}</div>
              <p className="text-2xl font-black text-game-text mt-2">{round.opponent_animal.name_ar}</p>
              <p className="text-game-text-muted text-xs mt-1">ساعد خصمك ليكتشف حيوانه!</p>
            </>
          ) : isPlayer ? (
            <>
              <p className="text-game-text-muted text-sm mb-2">حيوانك السري</p>
              <div className="text-8xl">❓</div>
              <p className="text-xl font-bold text-game-text mt-2">عليك اكتشافه!</p>
            </>
          ) : (
            // Audience / Host sees both
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: round?.player1_name, animal: round?.player1_animal },
                { name: round?.player2_name, animal: round?.player2_animal },
              ].map((p, i) => (
                <div key={i} className="text-center">
                  <p className="text-xs text-game-text-muted mb-1">{p.name}</p>
                  <div className="text-5xl">{p.animal?.emoji || '❓'}</div>
                  <p className="text-sm font-bold text-game-text mt-1">{p.animal?.name_ar}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Turn indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={round?.current_turn_player_id || 'none'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-xl px-4 py-3 text-center border font-semibold ${
              isMyTurn && isPlayer
                ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300 turn-pulse'
                : 'bg-game-card border-game-border text-game-text-muted'
            }`}
          >
            {isMyTurn && isPlayer
              ? '🎯 دورك الآن — اطرح سؤالاً أو خمّن!'
              : pendingQuestion
              ? amAnswerer
                ? `👀 ${pendingQuestion.asker_id === round?.player1_id ? round?.player1_name : round?.player2_name} ينتظر إجابتك`
                : `⏳ بانتظار إجابة ${participants.find(p => p.id !== pendingQuestion.asker_id && (p.id === round?.player1_id || p.id === round?.player2_id))?.display_name || '…'}…`
              : `🤔 ${currentTurnPlayer?.display_name || '…'} يفكر في سؤاله…`
            }
          </motion.div>
        </AnimatePresence>

        {/* Wrong guess notification */}
        <AnimatePresence>
          {lastWrongGuess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-3 text-center text-red-300"
            >
              ❌ تخمين خاطئ! {lastWrongGuess.animal.emoji} {lastWrongGuess.animal.name_ar} ليس حيوانك
            </motion.div>
          )}
        </AnimatePresence>

        {/* Answer buttons — for the opponent when there's a pending question */}
        <AnimatePresence>
          {amAnswerer && pendingQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl p-5 border border-amber-500/40 bg-amber-500/5"
            >
              <p className="text-sm text-amber-300 mb-1">سؤال خصمك:</p>
              <p className="text-game-text font-semibold mb-4">"{pendingQuestion.question_text}"</p>
              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={submitting}
                  onClick={() => handleAnswer('yes')}
                  className="py-4 rounded-xl bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 font-bold text-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                >
                  ✅ نعم
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={submitting}
                  onClick={() => handleAnswer('no')}
                  className="py-4 rounded-xl bg-red-500/20 border border-red-500/60 text-red-300 font-bold text-lg hover:bg-red-500/30 transition-all disabled:opacity-50"
                >
                  ❌ لا
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={submitting}
                  onClick={() => handleAnswer('invalid')}
                  className="py-4 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold text-base hover:bg-amber-500/30 transition-all disabled:opacity-50"
                >
                  🚫 غير صالح
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question input — my turn as player */}
        <AnimatePresence>
          {isMyTurn && isPlayer && !pendingQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl p-5 border border-indigo-500/40 space-y-3"
            >
              <label className="text-sm text-game-text-muted">اطرح سؤالاً يُجاب بنعم أو لا:</label>
              <div className="relative">
                <textarea
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  placeholder="هل حيواني يعيش في الماء؟"
                  maxLength={200}
                  rows={2}
                  className="w-full bg-game-surface border border-game-border rounded-xl py-3 px-4 text-game-text placeholder-game-text-muted focus:border-game-primary transition-colors resize-none text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmitQuestion()
                    }
                  }}
                />
              </div>

              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={!questionText.trim() || submitting}
                  onClick={handleSubmitQuestion}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-l from-indigo-600 to-violet-600 disabled:opacity-40 flex items-center justify-center gap-2 glow-primary transition-all"
                >
                  <Send size={16} />
                  إرسال السؤال
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowAnimalSelector(true)}
                  className="px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-l from-amber-500 to-orange-500 flex items-center gap-2 transition-all"
                  title="أعتقد أنني عرفت الحيوان"
                >
                  <Target size={16} />
                  <span className="text-sm">تخمين</span>
                </motion.button>
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question history */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl border border-game-border overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-game-border flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 className="font-bold text-game-text text-sm">سجل الأسئلة</h2>
            <span className="text-xs text-game-text-muted bg-game-surface px-2 py-0.5 rounded-full mr-auto">
              {questions.filter(q => q.is_valid).length} سؤال صالح
            </span>
          </div>
          <div className="p-5">
            <QuestionHistory questions={questions} myId={participantId} />
            <div ref={historyEndRef} />
          </div>
        </motion.div>

        {/* Audience note */}
        {!isPlayer && !isHost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-game-text-muted text-sm py-2 flex items-center justify-center gap-2"
          >
            <Eye size={16} />
            أنت تشاهد اللعبة
          </motion.div>
        )}
      </div>
    </div>
  )
}
