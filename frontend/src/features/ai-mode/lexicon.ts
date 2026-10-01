import { extraQuestions } from './catalogueQuestions'
/** Controlled, local vocabulary. Unknown words are never discarded. */
export const lexicon = new Map<string,string>()
const add=(concept:string, words:string)=>words.split('|').forEach(word=>lexicon.set(word,concept))
add('Q','هل|واش|ا|wach|wash')
add('SUB','انا|هو|هي|حيواني|الحيوان|ana|howa|hwa')
add('CLASSIFY','يعتبر|كيعتبر|كنعتبر|كيتعتبر|يعد|مصنف|yo3tabar|yu3tabar|y3tabar|kay3tabar|ki3tabar')
add('ANIMAL','حيوان|7ayawan|hayawan')
add('FROM','من|mn|min')
add('IN','في|ف|ب|علي|fi|f|b')
add('WITH','مع|m3a')
add('AND','و|وكذلك|w|wa')
add('OR','او|ولا|aw|wla|wela')
add('NOT','لا|ليس|لست|ماشي|مش|مو|machi|mashi')
add('CAN','استطيع|يستطيع|اقدر|يقدر|نقدر|كنقدر|كيقدر|يمكنني|يمكنه|قادر|kan9der|kanqder|n9der|kay9der')
add('TO','ان')
add('TOGETHER','معا')
add('HAVE','لدي|لديه|له|عندي|عنده|عندو|فيه|3ndi|3endi|3ndo|3ando')
add('SWIM','يسبح|كيسبح|اسبح|نسبح|كنسبح|السباحه|يعوم|كيعوم|نعوم|كنعوم|العوم|sb7|ysb7|kaysb7|kansb7|kanseb7|3om|n3om|kay3om|kan3om')
add('FLY','يطير|كيطير|اطير|نطير|كنطير|طير|يحلق|كيحلق|الطيران|ytir|kaytir|kantir|ntir')
add('LIVE','اعيش|يعيش|كيعيش|كنعيش|نعيش|يسكن|كيسكن|كنسكن|نسكن|اسكن|يوجد|يتواجد|كاين|كيكون|ساكن|عايش|يقطن|كيقطن|y3ich|kay3ich|kan3ich|kan3ish|yskon|kayskon|kanskon')
add('EAT','اكل|ااكل|ياكل|كياكل|كناكل|ناكل|كيوكل|كنوكل|يتناول|اتناول|يتغذي|اتغذي|كيتغذي|يقتات|yakol|kayakol|kanakol|kanakl')
add('ACTIVE','ينشط|انشط|كينشط|كننشط|يخرج|اخرج|كيخرج|كنخرج|يتحرك|kankhrej|kaykhrej')
add('NIGHT','ليلا|بالليل|فالليل|الليل|ليل|lil|llil')
add('GROUP','مجموعات|فمجموعات|مجموعة|مجموعه|جماعه|قطيع|قطعان|اسراب|groupe|group|jma3a')
add('MAMMAL','الثدييات|الثديات|ثدييات|ثديي|ttadyiyat|tadyiyat')
add('DOMESTIC','اليف|مستانس|اهلي|داجن|مدجن|alif')
add('FUR','فرو|الفرو|فراء|الفراء|شعر|الشعر|وبر|الوبر|صوف|الصوف')
add('HORNS','قرون|قرن|9ron|qron')
add('TAIL','ذيل|ديل|دنب|dil')
add('WATER','الماء|ماء|المياه|الما|فالما|فالماء|lma')
add('SEA','مائي|البحر|بحر|فالبحر|بالبحر|lb7er|b7er')
add('LAND','البر|فالبر|اليابسه|الارض')
add('DESERT','الصحراء|صحراء|الصحرا|صحرا|فالصحراء|فالصحرا|s7ra|se7ra|sahra')
add('JUNGLE','الغابه|غابه|لغابه|فالغابه|الغابات|الادغال|فالادغال|lghaba|ghaba')
add('ARCTIC','القطب|فالقطب')
add('AIR','الجو|الهواء')
add('HOME','المنزل|البيت|الدار|فالبيت|فالدار|المزرعه|فالضيعه|المزارع|دار|dar|ddar')
add('AFRICA','افريقيا|افريقي|ifri9i|afri9i|afriqi')
add('ORIGIN','موطنه|موطني|اصله')
add('SIZE','حجمه|حجمي|الحجم')
add('SMALL','صغير|صغيور')
add('MEDIUM','متوسط|وسط|وسطاني')
add('LARGE','كبير')
add('HUGE','ضخم|عملاق')
add('MEAT','اللحم|اللحوم|لحم|لحوم|l7em|le7m|l7m')
add('PLANTS','النباتات|النبات|العشب|الاعشاب|الحشائش|l3chb|l3chab')
add('HERBIVORE','عاشب|عشبي')
add('CARNIVORE','لاحم')
// These phrases express a single concept; order is longest-first in the scanner.
export const phrases: [string[],string][] = [
 ['هذا الحيوان','SUB'],['هاد الحيوان','SUB'],['ديال الدار','DOMESTIC'],['dial dar','DOMESTIC'],['dial ddar','DOMESTIC'],
 ['يغطي جسمه','HAVE'],['يغطي جسمي','HAVE'],['يغطيه','HAVE'],['جسمه مغطي','HAVE'],
 ['في المناطق القطبيه','ARCTIC'],['في القطب الشمالي','ARCTIC'],['في القطب الجنوبي','ARCTIC'],
 ['المناطق القطبيه','ARCTIC'],['ينتمي للثدييات','MAMMAL'],['صنفه ثديي','MAMMAL'],
 ['من اكله اللحوم','CARNIVORE'],['من اكله النباتات','HERBIVORE'],
 ['نقدر نربيه فالدار','DOMESTIC'],['يمكن تربيته في البيت','DOMESTIC'],
 ['كبير جدا','HUGE'],['متوسط الحجم','MEDIUM'],
].map(([s,c])=>[s.split(' '),c] as [string[],string]).sort((a,b)=>b[0].length-a[0].length)
for (const q of extraQuestions) {
 for (const alias of q.aliases) {
  const token='EXTRA:'+q.id
  if(alias.includes(' ')) phrases.push([alias.split(' '),token])
  else { lexicon.set(alias,token); if(/^[\u0600-\u06ff]+$/.test(alias)) lexicon.set('ال'+alias,token) }
 }
}
phrases.push([['يضع','البيض'],'EXTRA:lays_eggs'],[['كيحط','البيض'],'EXTRA:lays_eggs'])
phrases.sort((a,b)=>b[0].length-a[0].length)
export const vocabulary=[...lexicon.keys()]
export function oneEdit(a:string,b:string):boolean {
 if(Math.abs(a.length-b.length)>1)return false
 let i=0,j=0,edits=0
 while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return false;if(a.length<=b.length)j++;if(a.length>=b.length)i++}
 return edits+(i<a.length?1:0)+(j<b.length?1:0)===1
}
