import { motion, AnimatePresence } from 'framer-motion'
import QuestionAudio from './QuestionAudio'
import { Question as QuestionType } from '../../types/game'

interface Props {
  questions: QuestionType[]
  myId: string
}

const answerDisplay: Record<string, { label: string; color: string; icon: string }> = {
  yes: { label: 'نعم', color: 'text-emerald-400', icon: '✅' },
  no: { label: 'لا', color: 'text-red-400', icon: '❌' },
  invalid: { label: 'سؤال غير صالح', color: 'text-amber-400', icon: '🚫' },
  pending: { label: 'بانتظار الإجابة…', color: 'text-slate-400', icon: '⏳' },
}

export default function QuestionHistory({ questions, myId }: Props) {
  const validQuestions = questions

  if (validQuestions.length === 0) {
    return (
      <div className="text-center py-8 text-game-text-muted">
        <div className="text-5xl mb-3">💭</div>
        <p className="text-sm">لم يُطرح أي سؤال بعد</p>
        <p className="text-xs mt-1 text-slate-600">ستظهر الأسئلة والإجابات هنا</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[50vh] overflow-y-auto pb-2 pr-1">
      <AnimatePresence initial={false}>
        {validQuestions.map((q, idx) => {
          const ans = answerDisplay[q.answer] || answerDisplay.pending
          const isMyQuestion = q.asker_id === myId
          const borderClass =
            q.answer === 'yes'
              ? 'border-emerald-500/60'
              : q.answer === 'no'
              ? 'border-red-500/60'
              : q.answer === 'invalid'
              ? 'border-amber-500/60'
              : 'border-slate-600/60'

          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`border-r-2 ${borderClass} pr-3 space-y-1.5`}
            >
              {/* Question */}
              <div className="flex items-start gap-2">
                <div
                  className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                    isMyQuestion ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700/60 text-slate-400'
                  }`}
                >
                  {q.asker_name}
                </div>
                {q.question_type === 'audio' ? <QuestionAudio question={q} /> : <p className="text-sm text-game-text leading-relaxed">{q.question_text}</p>}
              </div>

              {/* Answer */}
              <div className={`flex items-center gap-1.5 text-sm ${ans.color} font-medium pr-2`}>
                <span>{ans.icon}</span>
                <span>{ans.label}</span>
              </div>

              {/* Divider */}
              {idx < validQuestions.length - 1 && (
                <div className="h-px bg-game-border/40 mt-2" />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
