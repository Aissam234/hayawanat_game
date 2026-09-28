import { answerHumanQuestion, getQuestion } from './engine'

export type Meaning = {questionId:string;negated:boolean}
export type Interpretation = {kind:'understood';parts:Meaning[];text:string}|{kind:'clarify';message:string;choices:Meaning[]}
export function normalizeArabic(text:string):string {
  return text.normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[؟?!.،,…]/g,' ').replace(/\s+/g,' ').trim()
}
// Full-clause grammar: unmatched words are never silently discarded. Every
// recognized meaning is shown for confirmation before an answer is requested.
const forms:[string,RegExp][] = [
  ['is_mammal',/^(?:من )?الثدييات$/],
  ['is_domestic',/^(?:(?:حيوان )?(?:اليف|مستانس)|يمكن تربيته في البيت|نقدر نربيه فالدار)$/],
  ['has_fur',/^(?:(?:عندي|لدي|عندو|عنده|لديه|له) (?:فرو|شعر)|يغطي (?:جسمي|جسمه) الفرو)$/],
  ['has_horns',/^(?:عندي|لدي|عندو|عنده|لديه|له) قرون$/],
  ['has_tail',/^(?:عندي|لدي|عندو|عنده|لديه|له) (?:ذيل|ديل)$/],
  ['can_fly',/^(?:(?:يقدر|يقدر ان|يستطيع|يمكنه|اقدر|اقدر ان|استطيع|يمكنني|نقدر|نقدر ان) )?(?:يطير|كيطير|اطير|طير|نطير|كنطير|الطيران)$/],
  ['can_swim',/^(?:(?:يقدر|يقدر ان|يستطيع|يمكنه|اقدر|اقدر ان|استطيع|يمكنني|نقدر|نقدر ان) )?(?:يسبح|كيسبح|اسبح|نسبح|كنسبح|السباحه)$/],
  ['is_nocturnal',/^(?:ينشط|كينشط|يخرج|كيخرج|انشط|كنخرج|اخرج|كننشط) (?:ليلا|بالليل|فالليل)$/],
  ['lives_in_groups',/^(?:يعيش|كيعيش|يوجد|يتواجد|كاين|كيكون|اعيش|كنعيش|نعيش) (?:في مجموعات|فمجموعات|مع جماعه)$/],
  ['habitat_water',/^(?:يعيش|كيعيش|يوجد|يتواجد|كاين|كيكون|اعيش|كنعيش|نعيش) (?:في الماء|فالماء|فالما|ف الما|في المياه|بالماء)$/],
  ['habitat_land',/^(?:يعيش|كيعيش|يوجد|يتواجد|كاين|كيكون|اعيش|كنعيش|نعيش) (?:في البر|فالبر|علي اليابسه)$/],
  ['habitat_desert',/^(?:يعيش|كيعيش|يوجد|يتواجد|كاين|كيكون|اعيش|كنعيش|نعيش) (?:في الصحراء|فالصحراء|فالصحرا)$/],
  ['habitat_jungle',/^(?:يعيش|كيعيش|يوجد|يتواجد|كاين|كيكون|اعيش|كنعيش|نعيش) (?:في الغابه|فالغابه)$/],
  ['habitat_arctic',/^(?:يعيش|كيعيش|يوجد|يتواجد|كاين|كيكون|اعيش|كنعيش|نعيش) (?:في القطب|فالقطب|في المناطق القطبيه)$/],
  ['habitat_domestic',/^(?:يعيش|كيعيش|يوجد|يتواجد|كاين|كيكون|اعيش|كنعيش|نعيش) (?:في المنزل|في البيت|فالبيت|فالدار|في المزرعه|فالضيعه)$/],
  ['size_small',/^(?:حجمه |حجمي |حيوان )?(?:صغير|صغيور)$/],
  ['size_medium',/^(?:حجمه |حجمي |حيوان )?متوسط(?: الحجم)?$/],
  ['size_large',/^(?:حجمه |حجمي |حيوان )?كبير(?: الحجم)?$/],
  ['size_huge',/^(?:حجمه |حجمي |حيوان )?ضخم(?: الحجم)?$/],
  ['diet_carnivore',/^(?:(?:ياكل|كياكل|كيوكل|يتغذي علي|اكل|ااكل|ناكل|كناكل|كنوكل|اتغذي علي) (?:اللحم|اللحوم)|لاحم|من اكله اللحوم)$/],
  ['diet_herbivore',/^(?:(?:ياكل|كياكل|كيوكل|يتغذي علي|اكل|ااكل|ناكل|كناكل|كنوكل|اتغذي علي) (?:النباتات|العشب|الاعشاب)|عاشب|من اكله النباتات)$/],
  ['diet_omnivore',/^(?:ياكل|كياكل|كيوكل|يتغذي علي|اكل|ااكل|ناكل|كناكل|كنوكل) (?:النباتات واللحوم|اللحم والنباتات|اللحوم والنباتات)(?: معا)?$/],
]
function clause(text:string):Meaning|undefined {
  let s=text.replace(/^(?:هل|واش) /,'').replace(/^(?:هو|انا|حيواني|هذا الحيوان|هاد الحيوان|الحيوان) /,'')
  let negated=false
  if(/^(?:لا|لست|ليس|ماشي|مش|مو) /.test(s)){negated=true;s=s.replace(/^(?:لا|لست|ليس|ماشي|مش|مو) /,'')}
  else if(/^ما .+ش$/.test(s)){negated=true;s=s.slice(3,-1).trim()}
  const form=forms.find(([,pattern])=>pattern.test(s))
  return form?{questionId:form[0],negated}:undefined
}
export function interpretArabic(raw:string):Interpretation {
  const text=normalizeArabic(raw).replace(/^هاد الحيوان عندي\s*/, '')
  const unsupported:Interpretation={kind:'clarify',message:'ما فهمتش السؤال بما يكفي. جرّب صياغة أبسط مثل «واش كيسبح؟» أو استخدم اقتراحات الأسئلة. لم تُستهلك محاولتك.',choices:[]}
  if(!text||text.length>200)return unsupported
  if(/(?:حديقه الحيوانات|حدائق الحيوانات|الجاردان|الزو)/.test(text))
    return {kind:'clarify',message:'فهمت، كتسول واش نقدر نلقاه في حديقة الحيوانات. هذا كيختلف من حديقة لأخرى، وما عنديش معلومة مؤكدة على هاد الصفة. نقدر نجاوبك عن موطنه أو واش مصنّف كحيوان أليف. سؤالك ما استهلكش الدور.',choices:[{questionId:'is_domestic',negated:false}]}
  const one=clause(text)
  if(one)return {kind:'understood',parts:[one],text:raw.trim()}
  if(/^(?:هل |واش )?(?:هو |انا |حيواني |هاد الحيوان )?(?:مائي|يعيش في البحر|كيعيش فالبحر|اعيش في البحر|كنعيش فالبحر|نعيش فالبحر|اعيش في المياه)$/.test(text))
    return {kind:'clarify',message:'تقصد موطنه الماء، أم قدرته على السباحة؟ لا توجد معلومة عن الماء المالح مقابل العذب في بطاقة اللعبة.',choices:[{questionId:'habitat_water',negated:false},{questionId:'can_swim',negated:false}]}
  // A food alternative asks for classification; never equate eating meat with
  // being exclusively carnivorous without showing the interpretation first.
  if(/^(?:هل |واش )?(?:هو |انا )?(?:ياكل|كياكل|كيوكل|يتغذي علي|اكل|ااكل|ناكل|كناكل) (?:اللحم|اللحوم) (?:ولا|او) النباتات$/.test(text))
    return {kind:'understood',parts:[{questionId:'diet_carnivore',negated:false},{questionId:'diet_herbivore',negated:false}],text:raw.trim()}
  const pieces=text.split(/\s+(?:و\s*|او\s+|ولا\s+)/)
  if(pieces.length===2){
    const parts=pieces.map(clause)
    if(parts.every(Boolean)&&parts[0]!.questionId!==parts[1]!.questionId)
      return {kind:'understood',parts:parts as Meaning[],text:raw.trim()}
  }
  return unsupported
}
export function meaningLabel(part:Meaning):string {
  const label=getQuestion(part.questionId)?.text || ''
  return part.negated?`هل العكس صحيح: «${label}»؟`:label
}
export function replyToMeanings(parts:Meaning[],humanSecret:number):string {
  return parts.map(part=>{
    const positive=answerHumanQuestion(part.questionId,humanSecret)==='yes'
    const agrees=part.negated?!positive:positive
    const natural:Record<string,[string,string]>={
      is_mammal:['حيوانك من الثدييات.','حيوانك ليس من الثدييات.'],
      can_swim:['حيوانك يستطيع السباحة بحسب بطاقة اللعبة.','بطاقة حيوانك لا تصنّفه كحيوان يستطيع السباحة.'],
      can_fly:['حيوانك يستطيع الطيران بحسب بطاقة اللعبة.','حيوانك لا يستطيع الطيران بحسب بطاقة اللعبة.'],
      habitat_water:['الماء هو موطن حيوانك في هذه اللعبة.','الماء ليس الموطن المصنّف لحيوانك.'],
      diet_carnivore:['حيوانك مصنّف ضمن آكلات اللحوم.','حيوانك ليس مصنّفاً ضمن آكلات اللحوم؛ قد يكون عاشباً أو يأكل النوعين.'],
      diet_herbivore:['حيوانك مصنّف ضمن آكلات النباتات.','حيوانك ليس مصنّفاً ضمن آكلات النباتات فقط.'],
    }
    const explanation=natural[part.questionId]?.[positive?0:1]
    return explanation?`${agrees?'نعم ✓':'لا ✕'} ${explanation}`:`${meaningLabel(part)} ${agrees?'نعم ✓':'لا ✕'}${part.negated?` (الصفة الأصلية: ${positive?'موجودة':'غير موجودة'})`:''}`
  }).join('\n')
}
