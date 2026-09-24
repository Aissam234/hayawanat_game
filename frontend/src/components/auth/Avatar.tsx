export const AVATARS = [
  { id: 'lion', emoji: '🦁', label: 'أسد' },
  { id: 'tiger', emoji: '🐯', label: 'نمر' },
  { id: 'fox', emoji: '🦊', label: 'ثعلب' },
  { id: 'panda', emoji: '🐼', label: 'باندا' },
  { id: 'bear', emoji: '🐻', label: 'دب' },
  { id: 'koala', emoji: '🐨', label: 'كوالا' },
  { id: 'rabbit', emoji: '🐰', label: 'أرنب' },
  { id: 'cat', emoji: '🐱', label: 'قط' },
  { id: 'dog', emoji: '🐶', label: 'كلب' },
  { id: 'frog', emoji: '🐸', label: 'ضفدع' },
  { id: 'owl', emoji: '🦉', label: 'بومة' },
  { id: 'penguin', emoji: '🐧', label: 'بطريق' },
] as const

export type AvatarId = typeof AVATARS[number]['id']

export default function Avatar({ id }: { id?: string }) {
  const avatar = AVATARS.find(a => a.id === id) || AVATARS[0]
  return <span role="img" aria-label={`الصورة الشخصية: ${avatar.label}`} className="text-2xl leading-none">{avatar.emoji}</span>
}
