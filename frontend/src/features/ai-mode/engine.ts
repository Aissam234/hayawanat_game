import data from './animals.json'
import legacyData from './animals.v1.json'
import { extraQuestions } from './catalogueQuestions'
export type CatalogueVersion = 1 | 2
export const CATALOGUE_VERSION: CatalogueVersion = 2

export type Difficulty = 'easy' | 'medium' | 'hard'
export type AnimalLevel = Difficulty | 'random'
export type Animal = typeof legacyData[number] & Partial<Omit<typeof data[number], keyof typeof legacyData[number]>> & { catalogueVersion: CatalogueVersion }
export const animals: readonly Animal[] = data.map(a => ({...a, catalogueVersion: 2}))
export const legacyAnimals: readonly Animal[] = legacyData.map(a => ({...a, catalogueVersion: 1}))
export type Answer = 'yes' | 'no' | 'invalid'
export type Question = { id: string; category: string; text: string; minCatalogueVersion?: 2; test: (animal: Animal) => boolean }

const bool = (id: keyof Animal, text: string, category = 'القدرات'): Question => ({
  id, text, category, test: a => Boolean(a[id]),
})

export const QUESTION_PREFIX = 'هاد الحيوان عندي…'
export const formatQuestion = (text: string) =>
  `${QUESTION_PREFIX} ${text.replace(/^(?:هل الحيوان عندي|هاد الحيوان عندي)\s*[.…؟?]*\s*/, '')}`

export const questions: readonly Question[] = [
  bool('is_mammal', 'واش هو من الثدييات؟', 'النوع'),
  bool('is_domestic', 'واش حيوان أليف؟', 'النوع'),
  bool('has_fur', 'واش جسمه مغطّي بالفرو؟', 'النوع'),
  bool('has_horns', 'واش عندو قرون؟', 'النوع'),
  bool('has_tail', 'واش عندو ديل؟', 'النوع'),
  bool('can_fly', 'واش كيقدر يطير؟'),
  bool('can_swim', 'واش كيقدر يسبح؟'),
  bool('is_nocturnal', 'واش كينشط بالليل؟'),
  bool('lives_in_groups', 'واش كيعيش فمجموعات؟'),
  bool('is_african', 'واش موطنه الأصلي كيشمل إفريقيا؟', 'الموطن'),
  ...(['water', 'land', 'desert', 'jungle', 'arctic', 'air', 'domestic'] as const).map(
    (value, i) => ({
      id: 'habitat_' + value,
      category: 'الموطن',
      text: [
        'هل موطنه الماء؟',
        'هل موطنه البر؟',
        'هل يعيش في الصحراء؟',
        'هل يعيش في الغابة؟',
        'هل موطنه المناطق القطبية؟',
        'هل موطنه المصنّف هو الجو؟',
        'هل موطنه المنزل أو المزرعة؟',
      ][i],
      test: (a: Animal) => a.habitat === value,
    }),
  ),
  ...(['small', 'medium', 'large', 'huge'] as const).map((value, i) => ({
    id: 'size_' + value,
    category: 'الحجم',
    text: ['هل حجمه صغير؟', 'هل حجمه متوسط؟', 'هل حجمه كبير؟', 'هل حجمه ضخم؟'][i],
    test: (a: Animal) => a.size === value,
  })),
  ...(['herbivore', 'carnivore', 'omnivore'] as const).map((value, i) => ({
    id: 'diet_' + value,
    category: 'الغذاء',
    text: [
      'واش من الحيوانات العاشبة (آكلات النباتات)؟',
      'واش من الحيوانات اللاحمة (آكلات اللحوم)؟',
      'واش من الحيوانات القارتة (آكلات النباتات واللحوم)؟',
    ][i],
    test: (a: Animal) => a.diet === value,
  })),
  ...extraQuestions,
]

export const getCatalogueAnimal = (id: number, version: CatalogueVersion = 2) => (version === 1 ? legacyAnimals : animals).find(a => a.id === id)!
export const questionsForCatalogue = (version: CatalogueVersion = 2) => questions.filter(q => !q.minCatalogueVersion || version === 2)
export const getAnimal = (id: number) => animals.find(a => a.id === id)!
export const getQuestion = (id: string) => questions.find(q => q.id === id)

export const getInitialCandidates = (level: AnimalLevel, version: CatalogueVersion = 2): Animal[] =>
  (version === 1 ? legacyAnimals : animals).filter(a => level === 'random' || a.difficulty === level)

export const evaluateQuestionSplit = (candidates: readonly Animal[], question: Question) => {
  const yes = candidates.filter(question.test).length
  const n=candidates.length,no=n-yes,p=n?yes/n:0
  const entropy=p>0&&p<1?-p*Math.log2(p)-(1-p)*Math.log2(1-p):0
  return {yes,no,score:Math.min(yes,no),expectedRemaining:n?(yes*yes+no*no)/n:0,entropy}
}

export const filterCandidates = (
  candidates: readonly Animal[],
  question: Question,
  answer: Answer,
): Animal[] =>
  answer === 'invalid'
    ? [...candidates]
    : candidates.filter(a => question.test(a) === (answer === 'yes'))

export const getPossibleQuestions = (
  candidates: readonly Animal[],
  asked: readonly string[],
): Question[] =>
  questions.filter(q => (!q.minCatalogueVersion || candidates.every(a => a.catalogueVersion === 2)) && !asked.includes(q.id) && evaluateQuestionSplit(candidates, q).score > 0)

/** Expected candidate count after up to two adaptive questions, uniform prior.
 * Terminal/unsplittable branches retain their size. Lower is better. */
export function evaluateLookahead(candidates:readonly Animal[],asked:readonly string[],q:Question):number {
  if(!candidates.length)return 0
  return [candidates.filter(q.test),candidates.filter(a=>!q.test(a))].reduce((total,branch)=>{
    const follow=getPossibleQuestions(branch,[...asked,q.id])
    const remaining=follow.length?Math.min(...follow.map(f=>evaluateQuestionSplit(branch,f).expectedRemaining)):branch.length
    return total+branch.length/candidates.length*remaining
  },0)
}
export function chooseBestQuestion(candidates:readonly Animal[],asked:readonly string[]):Question|undefined {
  const useful=getPossibleQuestions(candidates,asked)
  if(!useful.length)return undefined
  // Evaluate each predicate once. Pair intersections represent the same adaptive
  // two-level tree without repeatedly filtering arrays and retesting animal facts.
  const outcomes=useful.map(q=>candidates.map(a=>q.test(a)?1:0))
  const counts=outcomes.map(row=>row.reduce<number>((sum,x)=>sum+x,0))
  const n=candidates.length
  let best=0,bestTwo=Infinity,bestOne=Infinity
  for(let i=0;i<useful.length;i++){
    const yes=counts[i],no=n-yes
    let afterYes=yes,afterNo=no
    for(let j=0;j<useful.length;j++){
      if(i===j)continue
      let both=0
      for(let k=0;k<n;k++)both+=outcomes[i][k]*outcomes[j][k]
      const yesNo=yes-both,noYes=counts[j]-both,noNo=no-noYes
      afterYes=Math.min(afterYes,(both*both+yesNo*yesNo)/yes)
      afterNo=Math.min(afterNo,(noYes*noYes+noNo*noNo)/no)
    }
    const two=yes/n*afterYes+no/n*afterNo,one=(yes*yes+no*no)/n
    if(two<bestTwo || (two===bestTwo && one<bestOne)){best=i;bestTwo=two;bestOne=one}
  }
  return useful[best]
}
/** No prior distinguishes surviving candidates. Sample uniformly only when needed. */
export function pickBestGuess(candidates:readonly Animal[],random:()=>number):Animal {
  return candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]
}

// ---------------------------------------------------------------------------
// AI Action Selection
// ---------------------------------------------------------------------------

export type ReasoningState = {
  candidates: readonly Animal[]
  asked: readonly string[]
  difficulty: Difficulty
}
export type AiAction =
  | { type: 'question'; questionId: string }
  | { type: 'guess'; animalId: number; confidence: 'certain' | 'confident' | 'uncertain' }
  | { type: 'exhausted' }

export function chooseAiAction(knowledge: ReasoningState, random: () => number): AiAction {
  const { candidates, asked, difficulty } = knowledge
  if (!candidates.length) return { type: 'exhausted' }

  if(candidates.length===1)return {type:'guess',animalId:candidates[0].id,confidence:'certain'}
  const ranked=getPossibleQuestions(candidates,asked).sort((a,b)=>
    evaluateQuestionSplit(candidates,a).expectedRemaining-evaluateQuestionSplit(candidates,b).expectedRemaining)
  // Even at two candidates, ask if any unused property separates them.
  if(!ranked.length)return {type:'guess',animalId:pickBestGuess(candidates,random).id,confidence:'uncertain'}
  const optimal=chooseBestQuestion(candidates,asked)

  // Difficulty-based noise: easy sometimes picks a random question, medium slightly
  let chosenQuestion = optimal ?? ranked[0]
  if (difficulty === 'easy' && random() < 0.45) {
    chosenQuestion = ranked[Math.floor(random() * ranked.length)]
  } else if (difficulty === 'medium' && random() < 0.2) {
    chosenQuestion = ranked[Math.floor(random() * Math.min(3, ranked.length))]
  }

  return { type: 'question', questionId: chosenQuestion.id }
}

export const validateGuess = (guessId: number, secretId: number) => guessId === secretId

export const answerHumanQuestion = (questionId: string, humanSecret: number, version: CatalogueVersion = 2): Answer => {
  const q = getQuestion(questionId)
  if (!q) return 'invalid'
  return q.test(getCatalogueAnimal(humanSecret, version)) ? 'yes' : 'no'
}

export function selectSecrets(pool: readonly Animal[], random: () => number): [number, number] {
  if (pool.length < 2) throw new Error('At least two animals are required')
  const first = Math.floor(random() * pool.length)
  const second = (first + 1 + Math.floor(random() * (pool.length - 1))) % pool.length
  return [pool[first].id, pool[second].id]
}
