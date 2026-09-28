import data from './animals.json'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type AnimalLevel = Difficulty | 'random'
export type Animal = typeof data[number]
export const animals: readonly Animal[] = data
export type Answer = 'yes' | 'no' | 'invalid'
export type Question = { id:string; category:string; text:string; test:(animal:Animal)=>boolean }
const bool = (id: keyof Animal, text:string, category='القدرات'):Question => ({id, text, category, test:a=>Boolean(a[id])})
export const QUESTION_PREFIX = 'هاد الحيوان عندي…'
export const formatQuestion = (text:string) => `${QUESTION_PREFIX} ${text.replace(/^هاد الحيوان عندي\s*[.…]*\s*/, '')}`
export const questions: readonly Question[] = [
  bool('is_mammal','هل هو من الثدييات؟','النوع'),
  bool('is_domestic','هل يُصنّف كحيوان أليف في اللعبة؟','النوع'),
  bool('has_fur','هل يغطي جسمه الفرو؟','النوع'),
  bool('has_horns','هل لديه قرون؟','النوع'),
  bool('has_tail','هل لديه ذيل؟','النوع'),
  bool('can_fly','هل يستطيع الطيران بحسب بطاقة اللعبة؟'),
  bool('can_swim','هل يستطيع السباحة بحسب بطاقة اللعبة؟'),
  bool('is_nocturnal','هل ينشط ليلاً؟'),
  bool('lives_in_groups','هل يعيش في مجموعات؟'),
  ...(['water','land','desert','jungle','arctic','air','domestic'] as const).map((value,i)=>({id:'habitat_'+value,category:'الموطن',text:['هل موطنه الماء؟','هل موطنه البر؟','هل يعيش في الصحراء؟','هل يعيش في الغابة؟','هل يعيش في المناطق القطبية؟','هل موطنه المصنّف هو الجو؟','هل موطنه المنزل أو المزرعة؟'][i],test:(a:Animal)=>a.habitat===value})),
  ...(['small','medium','large','huge'] as const).map((value,i)=>({id:'size_'+value,category:'الحجم',text:['هل حجمه صغير؟','هل حجمه متوسط؟','هل حجمه كبير؟','هل حجمه ضخم؟'][i],test:(a:Animal)=>a.size===value})),
  ...(['herbivore','carnivore','omnivore'] as const).map((value,i)=>({id:'diet_'+value,category:'الغذاء',text:['هل يأكل النباتات؟','هل يُصنّف كآكل لحوم؟','هل يأكل النباتات واللحوم معاً؟'][i],test:(a:Animal)=>a.diet===value})),
]
export const getAnimal = (id:number) => animals.find(a=>a.id===id)!
export const getQuestion = (id:string) => questions.find(q=>q.id===id)
export const getInitialCandidates = (level:AnimalLevel):Animal[] => animals.filter(a=>level==='random'||a.difficulty===level)
export const evaluateQuestionSplit = (candidates:readonly Animal[], question:Question) => {
  const yes=candidates.filter(question.test).length
  return {yes,no:candidates.length-yes,score:Math.min(yes,candidates.length-yes)}
}
export const filterCandidates = (candidates:readonly Animal[],question:Question,answer:Answer):Animal[] =>
  answer==='invalid'?[...candidates]:candidates.filter(a=>question.test(a)===(answer==='yes'))
export const getPossibleQuestions = (candidates:readonly Animal[],asked:readonly string[]):Question[] =>
  questions.filter(q=>!asked.includes(q.id)&&evaluateQuestionSplit(candidates,q).score>0)
export function chooseBestQuestion(candidates:readonly Animal[],asked:readonly string[]):Question|undefined {
  return getPossibleQuestions(candidates,asked).sort((a,b)=>evaluateQuestionSplit(candidates,b).score-evaluateQuestionSplit(candidates,a).score)[0]
}
// Deliberately restricted knowledge: no round object and no secret identities.
export type ReasoningState = {candidates:readonly Animal[];asked:readonly string[];difficulty:Difficulty}
export type AiAction = {type:'question';questionId:string}|{type:'guess';animalId:number}|{type:'exhausted'}
export function chooseAiAction(knowledge:ReasoningState,random:()=>number):AiAction {
  const {candidates,asked,difficulty}=knowledge
  if(!candidates.length)return {type:'exhausted'}
  if(candidates.length===1 || (difficulty==='hard'&&candidates.length===2))
    return {type:'guess',animalId:candidates[Math.floor(random()*candidates.length)].id}
  const ranked=getPossibleQuestions(candidates,asked).sort((a,b)=>evaluateQuestionSplit(candidates,b).score-evaluateQuestionSplit(candidates,a).score)
  if(!ranked.length)return {type:'guess',animalId:candidates[Math.floor(random()*candidates.length)].id}
  let index=0
  if(difficulty==='easy'&&random()<0.45)index=Math.floor(random()*ranked.length)
  if(difficulty==='medium'&&random()<0.2)index=Math.floor(random()*Math.min(3,ranked.length))
  return {type:'question',questionId:ranked[index].id}
}
export const validateGuess = (guessId:number,secretId:number) => guessId===secretId
export const answerHumanQuestion = (questionId:string,humanSecret:number):Answer => {
  const q=getQuestion(questionId)
  if(!q)return 'invalid'
  return q.test(getAnimal(humanSecret))?'yes':'no'
}
export function selectSecrets(pool:readonly Animal[],random:()=>number):[number,number] {
  if(pool.length<2)throw new Error('At least two animals are required')
  const first=Math.floor(random()*pool.length)
  const second=(first+1+Math.floor(random()*(pool.length-1)))%pool.length
  return [pool[first].id,pool[second].id]
}
