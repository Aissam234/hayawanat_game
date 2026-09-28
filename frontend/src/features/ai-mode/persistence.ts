import { getAnimal, getInitialCandidates, getQuestion } from './engine'
import { Round, Settings, transition } from './round'

export const AI_SAVE_KEY = 'hayawanat.ai-round.v1'
type Save = {version:1;round:Round|null;settings:Settings;draft:string}
const object = (v:unknown):v is Record<string,any> => !!v && typeof v==='object' && !Array.isArray(v)
const integer = (v:unknown) => Number.isSafeInteger(v) && Number(v)>=0
const text = (v:unknown,max:number) => typeof v==='string' && v.length<=max
function settingsValid(v:unknown):v is Settings {
  return object(v) && ['easy','medium','hard'].includes(v.difficulty) && ['easy','medium','hard','random'].includes(v.animalLevel) && [0,20,30,60].includes(v.timer)
}
function roundValid(v:unknown):v is Round {
  if(!object(v)||!settingsValid(v.settings)||!integer(v.id)||!integer(v.started)||!text(v.message,10000))return false
  if(!object(v.scores)||!integer(v.scores.human)||!integer(v.scores.ai))return false
  if(!['human','answering','thinking','ai-question','finished'].includes(v.phase)||![null,'human','ai'].includes(v.winner))return false
  if(v.reason!==undefined&&!['timeout','exhausted'].includes(v.reason))return false
  if(v.ended!==undefined&&(!integer(v.ended)||v.ended<v.started))return false
  if(v.phase==='finished' ? v.ended===undefined : v.winner!==null)return false
  const pool=getInitialCandidates(v.settings.animalLevel).map(a=>a.id)
  if(!Array.isArray(v.pool)||JSON.stringify(v.pool)!==JSON.stringify(pool))return false
  if(!pool.includes(v.humanSecret)||!pool.includes(v.aiSecret)||v.humanSecret===v.aiSecret)return false
  if(!Array.isArray(v.candidates)||v.candidates.length>pool.length||v.candidates.some((id:unknown)=>!pool.includes(id as number))||new Set(v.candidates).size!==v.candidates.length)return false
  for(const list of [v.asked,v.humanAsked])if(!Array.isArray(list)||list.length>100||list.some((id:unknown)=>typeof id!=='string'||!getQuestion(id)))return false
  if(v.pending!==undefined&&(typeof v.pending!=='string'||!getQuestion(v.pending)))return false
  if(['answering','ai-question'].includes(v.phase)&&!v.pending)return false
  if(v.pendingText!==undefined){
    const p=v.pendingText
    if(!object(p)||!text(p.text,200)||!Array.isArray(p.parts)||!p.parts.length||p.parts.length>2)return false
    if(p.parts.some((part:unknown)=>!object(part)||typeof part.questionId!=='string'||!getQuestion(part.questionId)||typeof part.negated!=='boolean'))return false
    if(v.phase==='answering'&&p.parts[0].questionId!==v.pending)return false
  }
  if(!Array.isArray(v.history)||v.history.length>1000)return false
  return v.history.every((h:unknown)=>object(h)&&['human','ai'].includes(h.side)&&
    (h.kind==='question'?typeof h.value==='string'&&!!getQuestion(h.value)&&['yes','no','invalid'].includes(h.answer):h.kind==='guess'&&typeof h.value==='number'&&!!getAnimal(h.value)&&typeof h.answer==='boolean')&&
    (h.text===undefined||text(h.text,200))&&(h.reply===undefined||text(h.reply,10000)))
}
// Local-only progress. It is never used for account rewards or multiplayer scores.
export function decodeSave(raw:string|null,now:number):Save|null {
  try {
    if(!raw||raw.length>250000)return null
    const value:unknown=JSON.parse(raw)
    if(!object(value)||value.version!==1||!settingsValid(value.settings)||!text(value.draft,200)||(value.round!==null&&!roundValid(value.round)))return null
    return {version:1,settings:value.settings,draft:value.draft,round:value.round?transition(value.round,{type:'tick',now}):null}
  }catch{return null}
}
export function loadAiSave():Save|null {
  try{return decodeSave(localStorage.getItem(AI_SAVE_KEY),Date.now())}catch{return null}
}
export function saveAiRound(round:Round|null,settings:Settings,draft:string):boolean {
  try{localStorage.setItem(AI_SAVE_KEY,JSON.stringify({version:1,round,settings,draft}));return true}catch{return false}
}
