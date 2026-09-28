import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { QUESTION_PREFIX, formatQuestion, chooseAiAction, getAnimal, getQuestion, questions } from './engine'
import { interpretArabic, meaningLabel, Interpretation } from './arabic'
import { Event, Round, Settings, startRound, transition, visibleRound } from './round'
import { playSound } from '../../services/gameSounds'
import './AiPage.css'
import { loadAiSave, saveAiRound } from './persistence'

function Rival({thinking=false}:{thinking?:boolean}) {
  return <div className={'ai-rival'+(thinking?' is-thinking':'')} aria-hidden="true"><svg viewBox="0 0 160 160" fill="none"><defs><linearGradient id="rival-shell" x1="30" y1="20" x2="135" y2="140" gradientUnits="userSpaceOnUse"><stop stopColor="#b9f9e8"/><stop offset="1" stopColor="#5e9ab2"/></linearGradient></defs><path d="M80 36V19" stroke="#8fe7d5" strokeWidth="5"/><circle cx="80" cy="16" r="7" fill="#e4c77e"/><rect x="12" y="68" width="18" height="34" rx="8" fill="#639baa"/><rect x="130" y="68" width="18" height="34" rx="8" fill="#639baa"/><rect x="24" y="38" width="112" height="96" rx="35" fill="url(#rival-shell)"/><rect x="36" y="54" width="88" height="60" rx="23" fill="#101f30"/><g className="ai-rival-eyes" fill="#a3fbe1"><rect x="51" y="73" width="12" height="18" rx="6"/><rect x="97" y="73" width="12" height="18" rx="6"/></g><path d="M72 99Q80 105 88 99" stroke="#a3fbe1" strokeWidth="3" strokeLinecap="round"/><path d="M61 137L55 147H105L99 137" fill="#639baa"/></svg><span className="ai-rival-orbit"/></div>
}

const card='ai-card rounded-3xl border border-game-border bg-game-card p-5 sm:p-6'
const button='ai-button min-h-12 rounded-xl border border-game-border px-4 py-3 font-bold text-game-text disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400'
const defaults:Settings={difficulty:'medium',animalLevel:'easy',timer:0}
export default function AiPage(){
  const [saved]=useState(loadAiSave)
  const [settings,setSettings]=useState<Settings>(saved?.settings||defaults)
  const [round,setRound]=useState<Round|null>(saved?.round||null)
  const [questionText,setQuestionText]=useState(saved?.draft||'')
  const [saveFailed,setSaveFailed]=useState(false)
  useEffect(()=>{setSaveFailed(!saveAiRound(round,settings,questionText))},[round,settings,questionText])
  const [interpretation,setInterpretation]=useState<Interpretation|null>(null)
  const [category,setCategory]=useState('النوع')
  const [guessing,setGuessing]=useState(false)
  const [selected,setSelected]=useState<number|null>(null)
  const [clock,setClock]=useState(Date.now())
  const dialog=useRef<HTMLDialogElement>(null)
  const reduced=useReducedMotion()
  const result=useRef<HTMLElement>(null)
  function send(event:Event){setRound(old=>old?transition(old,event):old)}
  function begin(){setQuestionText('');setInterpretation(null);setRound(old=>startRound(settings,old,Date.now(),Math.random));setCategory('النوع');setSelected(null);setClock(Date.now());playSound('start')}
  useEffect(()=>{
    if(!round||round.phase==='finished')return
    const tick=()=>{const now=Date.now();setClock(now);send({type:'tick',now})}
    const interval=window.setInterval(tick,250)
    document.addEventListener('visibilitychange',tick)
    return ()=>{clearInterval(interval);document.removeEventListener('visibilitychange',tick)}
  },[round?.id,round?.phase==='finished'])
  useEffect(()=>{
    if(!round||!['answering','thinking'].includes(round.phase))return
    const captured=round
    const timer=window.setTimeout(()=>{
      const event:Event=captured.phase==='answering'?{type:'answer-human',now:Date.now()}:
        {type:'ai-action',now:Date.now(),action:chooseAiAction({candidates:captured.candidates.map(getAnimal),asked:captured.asked,difficulty:captured.settings.difficulty},Math.random)}
      setRound(old=>old?.id===captured.id?transition(old,event):old)
    },round.settings.difficulty==='easy'?1100:800)
    return ()=>clearTimeout(timer)
  },[round?.id,round?.phase,round?.pending])
  useEffect(()=>{if(guessing)dialog.current?.showModal();else dialog.current?.close()},[guessing])
  useEffect(()=>{
    if(round?.phase!=='human')setGuessing(false)
    if(round?.phase==='finished'){
      playSound(round.winner==='human'?'win':round.winner==='ai'?'lose':'finish')
      result.current?.focus({preventScroll:true});result.current?.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'})
    }
  },[round?.phase,round?.id])
  const visible=round?visibleRound(round):null
  const finished=round?.phase==='finished'
  const remaining=round&&round.settings.timer?Math.max(0,Math.min(round.settings.timer,Math.ceil((round.started+round.settings.timer*1000-clock)/1000))):null
  const panel=<section className={card+' ai-setup space-y-4'}>
    <div className="ai-eyebrow">اختر مستوى التحدّي</div><h2 className="text-xl font-bold">⚙️ إعدادات اللعب المحلي</h2>
    <label className="block">قوة الخصم<select className={button+' block w-full mt-2 bg-game-surface'} value={settings.difficulty} onChange={e=>setSettings({...settings,difficulty:e.target.value as Settings['difficulty']})}><option value="easy">سهل — أسئلة متنوعة وتخمين متأنٍّ</option><option value="medium">متوسط — استنتاج متوازن</option><option value="hard">صعب — أفضل الأسئلة وتخمين جريء</option></select></label>
    <label className="block">مجموعة الحيوانات<select className={button+' block w-full mt-2 bg-game-surface'} value={settings.animalLevel} onChange={e=>setSettings({...settings,animalLevel:e.target.value as Settings['animalLevel']})}><option value="easy">سهلة</option><option value="medium">متوسطة</option><option value="hard">صعبة</option><option value="random">عشوائي — جميع الحيوانات</option></select></label>
    <label className="block">مدة الجولة<select className={button+' block w-full mt-2 bg-game-surface'} value={settings.timer} onChange={e=>setSettings({...settings,timer:Number(e.target.value) as Settings['timer']})}><option value={0}>بلا وقت</option><option value={60}>60 ثانية</option><option value={30}>30 ثانية</option><option value={20}>20 ثانية</option></select></label>
    <button onClick={begin} className={button+' ai-launch w-full bg-gradient-to-l from-indigo-600 to-violet-600'}>{round?'🔄 جولة جديدة':'🎮 ابدأ اللعب'}</button>
  </section>
  return <main dir="rtl" className="ai-world min-h-screen text-game-text"><div className={'ai-shell '+(round&&!finished?'ai-playing':'ai-welcome')}><div className="ai-ambient" aria-hidden="true"><i/><i/><i/></div>
    <nav className="ai-nav flex items-center justify-between gap-3"><Link className={button} to="/">🏠 العودة للقائمة</Link><span className="text-emerald-300 text-sm">● محلي · بدون إنترنت</span></nav>
    {saveFailed&&<p role="alert" className="ai-footer">تعذّر حفظ الجولة على هذا المتصفح. يمكنك اللعب، لكن تحديث الصفحة قد يفقد تقدّمك.</p>}
    <header className="ai-hero">
      <div className="ai-hero-copy"><span className="ai-eyebrow">حيوانات · ساحة التحدّي</span><h1>{round?'العب ضد الذكاء الاصطناعي':<>ذكاؤك ضد <em>ذكائه.</em></>}</h1><p>حيوان مخفي. سؤال ذكي. ولحظة انتصار تستاهلها.</p>{!round&&<div className="ai-tags"><span>✦ بالعربية والدارجة</span><span>◈ بدون حساب</span><span>∞ جولات بلا حدود</span></div>}</div>
      <Rival thinking={round?.phase==='thinking'||round?.phase==='answering'}/>
    </header>
    <div aria-label="نتيجة الجلسة" className="ai-scoreboard"><div className={round?.phase==='human'?'is-active':''}><span className="ai-player-icon" aria-hidden="true">✦</span><span>أنت<strong>{round?.scores.human||0}</strong></span></div><div className="ai-score-middle"><span aria-hidden="true">VS</span><small>جولات هذه الجلسة</small></div><div className={round&&!['human','finished'].includes(round.phase)?'is-active':''}><span>الذكاء الاصطناعي<strong>{round?.scores.ai||0}</strong></span><span className="ai-player-icon ai-player-bot" aria-hidden="true">◈</span></div></div>
    {!round&&<><section className={card+' ai-intro'}><div className="ai-demo" aria-hidden="true"><div className="ai-demo-card ai-demo-known"><span>🦊</span><small>حيوان الخصم</small></div><div className="ai-demo-card ai-demo-secret"><span>؟</span><small>سرّك ينتظر اكتشافه</small></div><span className="ai-demo-spark">✦</span></div><span className="ai-eyebrow">كل سؤال يقرّبك</span><h2>هل تسبقه إلى الحل؟</h2><p>ترى حيوان خصمك، وهو يعرف حيوانك. اكتشف سرّك قبل أن يكتشف سرّه.</p><ol className="ai-steps"><li><b>01</b><span><strong>اسأل بطريقتك</strong>اكتب بالعربية أو الدارجة، ثم أكّد المعنى.</span></li><li><b>02</b><span><strong>اربط الأدلة</strong>راجع الإجابات، وأجب عن سؤال خصمك بصدق.</span></li><li><b>03</b><span><strong>اقتنص الفوز</strong>عرفت حيوانك؟ اختره وأكّد تخمينك!</span></li></ol><p className="ai-session-note">تُحفظ الجولة تلقائياً على هذا المتصفح. يمكنك تحديث الصفحة والمتابعة؛ المؤقت لا يتوقف.</p></section>{panel}</>}
    {round&&finished&&<><section ref={result} tabIndex={-1} aria-label="نتيجة الجولة" className={card+' ai-result text-center space-y-5'}><div className={'ai-result-emblem '+(round.winner==='human'?'ai-victory':'')} aria-hidden="true">{round.winner==='human'?'🏆':round.winner==='ai'?'◈':'⌛'}{round.winner==='human'&&Array.from({length:12},(_,i)=><i key={i} style={{transform:`rotate(${i*30}deg) translateY(-76px)`}}/>)}</div><span className="ai-eyebrow">{round.winner==='human'?'استنتاج رائع · انتصار مستحق':'كل جولة تجعلك أذكى'}</span><h2 className="text-3xl font-black text-amber-300">{round.winner==='human'?'🏆 لقد فزت!':round.winner==='ai'?'🤖 الذكاء الاصطناعي فاز':round.reason==='timeout'?'⏳ انتهى الوقت — تعادل':'انتهت الجولة — لم تبقَ مرشحات متوافقة'}</h2><div className="grid grid-cols-2 gap-3">{[{title:'حيوانك',animal:visible!.own!},{title:'حيوان الخصم',animal:visible!.opponent}].map(a=><div key={a.title} className="bg-game-surface rounded-2xl p-4"><p>{a.title}</p><div className="text-5xl my-4">{a.animal.emoji}</div><strong>{a.animal.name_ar}</strong></div>)}</div><div className="grid grid-cols-3 gap-2 text-sm"><p>أسئلة<strong className="block text-xl">{round.history.filter(h=>h.kind==='question').length}</strong></p><p>تخمينات<strong className="block text-xl">{round.history.filter(h=>h.kind==='guess').length}</strong></p><p>ثوانٍ<strong className="block text-xl">{Math.max(0,Math.round(((round.ended||clock)-round.started)/1000))}</strong></p></div></section>{panel}</>}
    {round&&!finished&&<>
      <section className={card+' ai-opponent text-center'} aria-label="حيوان الخصم"><p className="text-game-text-muted">حيوان خصمك — أجب عن أسئلته بناءً عليه</p><div className="ai-animal-stage" aria-hidden="true">{visible!.opponent.emoji}</div><h2 className="text-3xl font-black">{visible!.opponent.name_ar}</h2><details className="text-sm mt-4 text-game-text-muted"><summary className="cursor-pointer min-h-11">بطاقة الخصم للمساعدة في الإجابة</summary><div className="grid sm:grid-cols-2 gap-2 text-right">{questions.map(q=><p key={q.id}>{formatQuestion(q.text)} <strong>{q.test(visible!.opponent)?'نعم':'لا'}</strong></p>)}</div></details></section>
      <div className="ai-round-strip flex items-center justify-between gap-3"><p className="text-game-text-muted" data-testid="hidden-own">🔒 حيوانك مخفي حتى نهاية الجولة</p>{remaining!==null&&<p role="timer" className={'ai-timer text-amber-300 font-bold'+(remaining<=5?' is-urgent':'')}>⏱ {remaining} ث</p>}</div>
      <section className={card+' ai-console space-y-4'} data-phase={round.phase}>
        <motion.h2 key={round.phase} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} className="font-black text-xl">{round.phase==='human'?'🎯 دورك — اسأل أو خمن':round.phase==='answering'?'🤖 الخصم يجيب…':round.phase==='thinking'?'🤖 الذكاء الاصطناعي يفكر…':'🤖 سؤال الخصم'}</motion.h2>
        {['answering','thinking'].includes(round.phase)&&<div className="ai-thinking" aria-hidden="true"><span/><span/><span/><div className="ai-thinking-track"/></div>}
        <p role="status" className="text-sm text-indigo-200 leading-7 whitespace-pre-line">{round.message}</p>
        {round.phase==='human'&&<>
          <form className="ai-composer space-y-3" onSubmit={e=>{e.preventDefault();setInterpretation(interpretArabic(questionText))}}>
            <label htmlFor="ai-arabic-question" className="block font-bold">💬 اسأل بطريقتك</label>
            <p id="ai-question-prefix" className="font-bold text-indigo-200">{QUESTION_PREFIX}</p>
            <textarea aria-describedby="ai-question-prefix" id="ai-arabic-question" dir="rtl" maxLength={200} rows={2} value={questionText} onChange={e=>{setQuestionText(e.target.value);setInterpretation(null)}} placeholder="مثلاً: واش كيسبح؟ أو هل هو من الثدييات؟" className="w-full bg-game-surface rounded-2xl border border-game-border p-4 focus:border-violet-400" />
            <p className="text-xs text-game-text-muted leading-6">أفهم صيغاً شائعة عن النوع والموطن والحجم والغذاء والقدرات، وليس كل الكلام الحر. سأطلب توضيحاً عند الحاجة.</p>
            <button disabled={!questionText.trim()} className={button+' w-full bg-game-primary/30'} type="submit">💬 أرسل سؤالي</button>
          </form>
          {interpretation && <div role="status" className="rounded-2xl bg-indigo-950/60 border border-indigo-400/30 p-4 space-y-3">
            {interpretation.kind==='understood'?<><p className="font-bold">فهمت سؤالك بهذا المعنى:</p>{interpretation.parts.map(part=><p key={part.questionId}>{formatQuestion(meaningLabel(part))}</p>)}<p className="text-xs text-game-text-muted">{interpretation.parts.length===2?'سأجيب عن الجزأين بشكل منفصل في دور واحد.':'هل هذا ما تقصده؟'}</p><button className={button+' bg-game-primary w-full'} onClick={()=>{send({type:'ask-text',text:questionText,now:Date.now()});setQuestionText('');setInterpretation(null);playSound('question')}}>نعم، اسأل بهذا المعنى</button></>:<><p>{interpretation.message}</p>{interpretation.choices.map(part=><button className={button+' block w-full text-right'} key={part.questionId} onClick={()=>{send({type:'ask',questionId:part.questionId,now:Date.now()});setQuestionText('');setInterpretation(null)}}>{formatQuestion(meaningLabel(part))}</button>)}</>}
            <button className={button+' w-full'} onClick={()=>{setInterpretation(null);document.getElementById('ai-arabic-question')?.focus()}}>تعديل سؤالي</button>
          </div>}
          <details><summary className="cursor-pointer min-h-12 py-3 text-game-text-muted">💡 اقتراحات الأسئلة</summary><div className="flex flex-wrap gap-2" aria-label="تصنيف الأسئلة">{['النوع','الموطن','الحجم','الغذاء','القدرات'].map(c=><button className={button+(category===c?' bg-game-primary/30':' bg-game-surface')} key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="grid sm:grid-cols-2 gap-2">{questions.filter(q=>q.category===category).map(q=><button key={q.id} className={button+' text-right bg-game-surface text-sm'} disabled={round.humanAsked.includes(q.id)} onClick={()=>{playSound('question');send({type:'ask',questionId:q.id,now:Date.now()})}}>{formatQuestion(q.text)}</button>)}</div></details><button className={button+' ai-guess-action w-full bg-amber-600 text-white'} onClick={()=>{setSelected(null);setGuessing(true)}}>🎯 عرفت حيواني</button></>}
        {round.phase==='ai-question'&&<><p className="rounded-xl bg-game-primary/20 p-4 text-lg">{formatQuestion(getQuestion(round.pending!)?.text || '')}</p><div className="grid grid-cols-3 gap-2">{([{value:'yes',label:'✅ نعم'},{value:'no',label:'❌ لا'},{value:'invalid',label:'🚫 غير صالح'}] as const).map(a=><button key={a.value} className={button+' bg-game-surface px-2'} onClick={()=>send({type:'answer-ai',answer:a.value,now:Date.now()})}>{a.label}</button>)}</div></>}
      </section>
    </>}
    {round&&<section className={card+' ai-history'}><h2 className="text-xl font-bold mb-4">💬 سجل الجولة</h2><div className="max-h-80 overflow-y-auto space-y-3" aria-live="polite">{!round.history.length&&<p className="text-game-text-muted">ابدأ بسؤالك الأول.</p>}{[...round.history].reverse().map((h,i)=><div key={round.history.length-i} className={'ai-chat-entry bg-game-surface rounded-xl p-3 text-sm leading-7 '+(h.side==='human'?'from-human':'from-ai')}><strong>{h.side==='human'?'أنت':'🤖 الخصم'}: </strong>{h.kind==='question'?formatQuestion(h.text||getQuestion(String(h.value))?.text||''):`هل حيواني ${getAnimal(Number(h.value)).name_ar}؟`}<span className="block text-indigo-200 whitespace-pre-line">{h.reply||(h.answer===true||h.answer==='yes'?'✅ نعم':h.answer==='invalid'?'🚫 غير صالح':'❌ لا')}</span></div>)}</div></section>}
    <p className="ai-footer text-xs text-game-text-muted text-center leading-6">خصم محلي يعتمد على الاستنتاج وصفات مجموعة اللعبة، وليس نموذج محادثة. نقاطه لا تغيّر حسابك أو ترتيبك أونلاين.</p>
  </div><dialog ref={dialog} dir="rtl" aria-labelledby="ai-guess-title" onCancel={()=>setGuessing(false)} className="ai-guess-dialog w-[calc(100%-24px)] max-w-xl max-h-[85dvh] overflow-y-auto rounded-3xl border border-game-border bg-game-bg text-game-text p-5 backdrop:bg-black/80"><h2 id="ai-guess-title" className="text-xl font-bold mb-4">ما حيوانك؟</h2><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{round?.pool.map(id=>{const a=getAnimal(id);return <button key={id} aria-pressed={selected===id} className={button+(selected===id?' bg-game-primary':' bg-game-surface')} onClick={()=>setSelected(id)}><span className="block text-3xl">{a.emoji}</span><span className="text-sm">{a.name_ar}</span></button>})}</div><div className="sticky bottom-0 bg-game-bg pt-4 flex gap-2"><button autoFocus className={button+' flex-1'} onClick={()=>setGuessing(false)}>رجوع</button><button disabled={selected===null} className={button+' flex-1 bg-game-primary'} onClick={()=>{if(selected!==null){send({type:'human-guess',animalId:selected,now:Date.now()});setGuessing(false)}}}>تأكيد التخمين</button></div></dialog></main>
}
