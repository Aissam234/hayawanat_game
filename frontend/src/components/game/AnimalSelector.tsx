import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Animal } from '../../types/game'
import { Search, X } from 'lucide-react'

interface Props {
  animals: Animal[]
  onSelect: (animal: Animal) => void
  onClose: () => void
}

const difficultyLabel: Record<string, string> = {
  easy: '🐣 سهل',
  medium: '🦊 متوسط',
  hard: '🦎 صعب',
}

export default function AnimalSelector({ animals, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Animal | null>(null)

  const filtered = animals.filter(a =>
    a.name_ar.includes(search) || a.emoji.includes(search)
  )

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="glass-strong rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-game-border">
            <div>
              <h2 className="text-xl font-bold text-game-text">🎯 اختر الحيوان</h2>
              <p className="text-game-text-muted text-sm mt-0.5">ما هو حيوانك؟</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-game-surface text-game-text-muted hover:text-game-text transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-game-border">
            <div className="relative">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-game-text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن حيوان…"
                className="w-full bg-game-surface border border-game-border rounded-xl py-2.5 pr-10 pl-4 text-game-text placeholder-game-text-muted focus:border-game-primary transition-colors text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Animal grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map(animal => (
                <motion.button
                  key={animal.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelected(animal)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                    selected?.id === animal.id
                      ? 'bg-indigo-500/30 border-indigo-500 glow-primary'
                      : 'bg-game-card border-game-border hover:border-game-primary/50'
                  }`}
                >
                  <span className="text-3xl">{animal.emoji}</span>
                  <span className="text-xs text-game-text font-medium text-center leading-tight">{animal.name_ar}</span>
                </motion.button>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-center text-game-text-muted py-8">لا نتائج</p>
            )}
          </div>

          {/* Confirm button */}
          <div className="p-4 border-t border-game-border">
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-game-card rounded-xl p-3 mb-3 border border-game-border"
              >
                <span className="text-3xl">{selected.emoji}</span>
                <div>
                  <p className="font-bold text-game-text">{selected.name_ar}</p>
                  <p className="text-xs text-game-text-muted">{difficultyLabel[selected.difficulty]}</p>
                </div>
              </motion.div>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!selected}
              onClick={() => selected && onSelect(selected)}
              className="w-full py-3 rounded-xl font-bold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 glow-primary"
            >
              {selected ? `✅ تأكيد: ${selected.name_ar} ${selected.emoji}` : 'اختر حيوانًا أولاً'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
