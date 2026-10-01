import { extraQuestions } from './catalogueQuestions'
import { CatalogueVersion, answerHumanQuestion, getQuestion } from './engine'
import { lexicon, phrases, vocabulary, oneEdit } from './lexicon'
export type Meaning = {questionId:string;negated:boolean}
export type Interpretation = {kind:'understood';parts:Meaning[];text:string}|{kind:'clarify';message:string;choices:Meaning[]}
export type SemanticMeaning = Meaning & {confidence:1;source:'exact-or-reviewed-alias'}
export function detectScript(text:string):'arabic'|'arabizi'|'mixed' {
 const ar=/[\u0600-\u06ff]/.test(text), latin=/[a-z]/i.test(text)
 return ar&&latin?'mixed':latin?'arabizi':'arabic'
}
export function normalizeArabic(text:string):string {
 return text.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[؟?!.،,…]/g,' ').replace(/\s+/g,' ').trim()
}
const clarify=(message:string,choices:Meaning[]=[]):Interpretation=>({kind:'clarify',message,choices})
const unsupported=()=>clarify('هاد الصفة مازال ما كايناش فمعلومات اللعبة 😅 جرّب تسول على الموطن، الحجم، الغذاء، السباحة، الطيران أو الصفات الجسدية. ما تستهلكش دورك.')
const ambiguous=()=>clarify('كتقصد واش الماء هو الموطن ديالو، ولا واش كيقدر يسبح؟',[{questionId:'habitat_water',negated:false},{questionId:'can_swim',negated:false}])
const habitats:Record<string,string>={WATER:'water',LAND:'land',DESERT:'desert',JUNGLE:'jungle',ARCTIC:'arctic',AIR:'air',HOME:'domestic'}
const sizes:Record<string,string>={SMALL:'small',MEDIUM:'medium',LARGE:'large',HUGE:'huge'}
const features:Record<string,string>={FUR:'has_fur',HORNS:'has_horns',TAIL:'has_tail'}
// Token-level negation, including attached Darija ma...ch/m...ش, only if the
// recovered verb exists in the vocabulary. Never replace digits globally.
function negativeVerb(word:string):string|undefined {
 for(const [prefix,suffix] of [['ma','ch'],['ما','ش'],['م','ش']]){
  if(word.startsWith(prefix)&&word.endsWith(suffix)){
   const inner=word.slice(prefix.length,-suffix.length)
   if(lexicon.has(inner))return inner
  }
 }
 return undefined
}
function tokenize(text:string):{tokens:string[];unknown:string[]} {
 const words=text.split(' '),tokens:string[]=[],unknown:string[]=[]
 for(let i=0;i<words.length;i++){
  const phrase=phrases.find(([p])=>p.every((w,j)=>words[i+j]===w))
  if(phrase){tokens.push(phrase[1]);i+=phrase[0].length-1;continue}
  let word=words[i]
  if((word==='ma'||word==='ما')&&i+1<words.length){
   const next=words[i+1],suffix=word==='ma'?'ch':'ش'
   const stem=next.endsWith(suffix)?next.slice(0,-suffix.length):''
   if(lexicon.has(stem)){tokens.push('NOT',lexicon.get(stem)!);i++;continue}
  }
  // ma is water only following a location preposition; otherwise unknown.
  if(word==='ma'&&tokens[tokens.length-1]==='IN'){tokens.push('WATER');continue}
  const neg=negativeVerb(word)
  if(neg){tokens.push('NOT',lexicon.get(neg)!);continue}
  if(!lexicon.has(word)&&word.startsWith('و')&&(lexicon.has(word.slice(1))||negativeVerb(word.slice(1)))){
   tokens.push('AND');word=word.slice(1)
   const n=negativeVerb(word);if(n){tokens.push('NOT',lexicon.get(n)!);continue}
  }
  const token=lexicon.get(word)
  if(token)tokens.push(token);else{tokens.push('?');unknown.push(word)}
 }
 return {tokens,unknown}
}
function clause(input:string[]):SemanticMeaning|undefined {
 const t=[...input]
 const head=()=>t[0]
 if(head()==='Q')t.shift()
 if(head()==='SUB')t.shift()
 let negated=false
 if(head()==='NOT'){negated=true;t.shift()}
 if(head()==='ANIMAL')t.shift()
 // A copula only introduces a property; unknown words and double negation remain rejected.
 const classified=head()==='CLASSIFY'
 if(classified){t.shift();if(head()==='ANIMAL')t.shift()}
 if(head()==='FROM')t.shift()
 if(classified && (t.length!==1 || !(head()?.startsWith('EXTRA:') || ['MAMMAL','DOMESTIC','CARNIVORE','HERBIVORE',...Object.keys(sizes)].includes(head()))))return undefined
 const one=(questionId:string):SemanticMeaning=>({questionId,negated,confidence:1,source:'exact-or-reviewed-alias'})
 if(head()==='CAN'){t.shift();if(head()==='TO')t.shift();if(!['SWIM','FLY'].includes(head()))return undefined}
 if(t.length===1 && head()?.startsWith('EXTRA:')) return one(head().slice(6))
 if(t.length===2 && head()==='HAVE' && /^EXTRA:(?:has_|legs_|humps_)/.test(t[1])) return one(t[1].slice(6))
 if(t.length===2 && head()==='ORIGIN' && t[1].startsWith('EXTRA:region_')) return one(t[1].slice(6))
 if(t.length===3 && ['LIVE','ORIGIN'].includes(head()) && ['IN','FROM'].includes(t[1]) && t[2].startsWith('EXTRA:region_')) return one(t[2].slice(6))
 if(t.length===1){
  const direct:Record<string,string>={MAMMAL:'is_mammal',DOMESTIC:'is_domestic',SWIM:'can_swim',FLY:'can_fly',AFRICA:'is_african',HERBIVORE:'diet_herbivore',CARNIVORE:'diet_carnivore'}
  if(direct[head()])return one(direct[head()])
  if(sizes[head()])return one('size_'+sizes[head()])
 }
 if(t.length===2&&head()==='HAVE'&&features[t[1]])return one(features[t[1]])
 if(head()==='SIZE'&&t.length===2&&sizes[t[1]])return one('size_'+sizes[t[1]])
 if(head()==='ACTIVE'){
  t.shift();if(head()==='IN')t.shift()
  if(t.length===1&&head()==='NIGHT')return one('is_nocturnal')
  return undefined
 }
 if(head()==='LIVE'||head()==='ORIGIN'){
  t.shift();if(['IN','WITH','FROM'].includes(head()))t.shift()
  if(t.length!==1)return undefined
  if(head()==='GROUP')return one('lives_in_groups')
  if(head()==='AFRICA')return one('is_african')
  if(habitats[head()])return one('habitat_'+habitats[head()])
 }
 if(head()==='EAT' && t.length===2 && t[1]==='EXTRA:diet_detritivore')return one('diet_detritivore')
 if(head()==='EAT'){
  if(t[t.length-1]==='TOGETHER')t.pop()
  t.shift();if(head()==='IN')t.shift()
  if(t.length===1&&['MEAT','PLANTS'].includes(head()))return one(head()==='MEAT'?'diet_carnivore':'diet_herbivore')
  if(t.length===3&&t[1]==='AND'&&new Set([head(),t[2]]).size===2&&[head(),t[2]].every(x=>['MEAT','PLANTS'].includes(x)))return one('diet_omnivore')
 }
 return undefined
}
const meaning=(p:SemanticMeaning):Meaning=>({questionId:p.questionId,negated:p.negated})
export function interpretArabic(raw:string):Interpretation {
 if(!raw.trim()||raw.length>200)return unsupported()
 const script=detectScript(raw)
 // Latin normalization never substitutes digits; mixed input uses the same controlled lexicon.
 const normalized=script==='arabizi'?raw.normalize('NFKC').toLowerCase().replace(/[?!.,]/g,' ').replace(/\s+/g,' ').trim():normalizeArabic(raw)
 const text=normalized.replace(/^(?:هاد الحيوان عندي|هل الحيوان عندي)\s*/,'')
 if(/حديقه الحيوانات|حدائق الحيوانات/.test(text))return clarify('فهمت، كتسول على حديقة الحيوانات. هاد المعلومة كتختلف بين الحدائق وما كايناش فبطاقة اللعبة. جرّب واش الحيوان أليف؛ دورك باقي ليك.',[{questionId:'is_domestic',negated:false}])
 const {tokens,unknown}=tokenize(text)
 if(unknown.length){
  // Only offer a correction for ONE bounded known-vocabulary typo, never apply it.
  if(unknown.length===1&&unknown[0].length>=5&&unknown[0].length<=18){
   const candidates=vocabulary.filter(w=>oneEdit(unknown[0],w))
   const concepts=new Set(candidates.map(w=>lexicon.get(w)))
   if(concepts.size===1){const corrected=tokens.map(t=>t==='?'?[...concepts][0]!:t),p=clause(corrected);if(p)return clarify(`واش كتقصد «${getQuestion(p.questionId)?.text}»؟ صحّحنا كلمة محتملة؛ أكّد المعنى قبل الجواب.`,[meaning(p)])}
  }
  return unsupported()
 }
 if(tokens.includes('SEA'))return ambiguous()
 const one=clause(tokens)
 if(one)return {kind:'understood',parts:[meaning(one)],text:raw.trim()}
 const or=tokens.indexOf('OR')
 if(or>=0){
  let left=clause(tokens.slice(0,or)),right=clause(tokens.slice(or+1))
  if(!right&&tokens.slice(or+1).length===1&&tokens.includes('EAT'))right=clause(['EAT',tokens[or+1]])
  const choices=[left,right].filter((p):p is SemanticMeaning=>!!p).map(meaning)
  return clarify('كتسول على واحد من هاد الاحتمالات؟ اختار صفة وحدة، وما غاديش نحسب «أو» بحال «و».',choices.length===2?choices:[])
 }
 const and=tokens.indexOf('AND')
 if(and>=0&&tokens.lastIndexOf('AND')===and){
  const parts=[clause(tokens.slice(0,and)),clause(tokens.slice(and+1))]
  if(parts.every(Boolean)&&parts[0]!.questionId!==parts[1]!.questionId)return {kind:'understood',parts:parts.map(p=>meaning(p!)),text:raw.trim()}
 }
 return unsupported()
}
export function meaningLabel(part:Meaning):string {
 const label=getQuestion(part.questionId)?.text||''
 return part.negated?`هل العكس صحيح: «${label}»؟`:label
}
export function replyToMeanings(parts:Meaning[],humanSecret:number,version:CatalogueVersion=2):string {
 return parts.map(part=>{
  const positive=answerHumanQuestion(part.questionId,humanSecret,version)==='yes',agrees=part.negated?!positive:positive
  const descriptions:Record<string,string>={is_mammal:'من الثدييات',is_domestic:'مصنّف كحيوان أليف',has_fur:'عنده فرو',has_horns:'عنده قرون',has_tail:'عنده ذيل',can_swim:'كيقدر يسبح',can_fly:'كيقدر يطير',is_nocturnal:'ينشط ليلاً',lives_in_groups:'كيعيش في مجموعات',is_african:'مصنّف كحيوان إفريقي',habitat_water:'موطنه الماء',habitat_land:'موطنه البر',habitat_desert:'موطنه الصحراء',habitat_jungle:'موطنه الغابة',habitat_arctic:'موطنه المناطق القطبية',habitat_air:'موطنه الجو',habitat_domestic:'موطنه المنزل أو المزرعة',size_small:'حجمه صغير',size_medium:'حجمه متوسط',size_large:'حجمه كبير',size_huge:'حجمه ضخم',diet_carnivore:'مصنّف ضمن آكلات اللحوم',diet_herbivore:'مصنّف ضمن آكلات النباتات',diet_omnivore:'مصنّف ضمن آكلات النباتات واللحوم'}
  return `${agrees?'نعم ✓':'لا ✕'} ${positive?'حيوانك':'بطاقة حيوانك لا تؤكد أنه'} ${descriptions[part.questionId]||extraQuestions.find(q=>q.id===part.questionId)?.description||''}${positive?' حسب بطاقة اللعبة.':'.'}`
 }).join('\n')
}
