import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import './ModeMenu.css'
export default function ModeMenu(){
  const {search}=useLocation()
  const [paused,setPaused]=useState(false)
  if(new URLSearchParams(search).has('join'))return <Navigate replace to={'/friends'+search}/>
  return <main dir="rtl" className="mode-home"><div className={'mode-rain'+(paused?' is-paused':'')} aria-hidden="true">{['🦊','🐼','🦁','🐸','🐯','🦋','🐵','🐰','🦉','🐢'].map((animal,i)=><span key={animal} style={{left:`${4+i*10}%`,animationDuration:`${16+i%4*3}s`,animationDelay:`-${i*2.7}s`,fontSize:`${24+i%3*7}px`}}>{animal}</span>)}</div><div className="mode-home-shell">
    <header className="mode-heading"><div className="mode-logo" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><defs><linearGradient id="home-union-paw" x1="8" y1="18" x2="55" y2="45" gradientUnits="userSpaceOnUse"><stop stopColor="#a1ecd6"/><stop offset="1" stopColor="#ffc76d"/></linearGradient></defs><g fill="url(#home-union-paw)"><ellipse cx="13" cy="27" rx="7" ry="9" transform="rotate(-25 13 27)"/><ellipse cx="25" cy="16" rx="7" ry="9" transform="rotate(-10 25 16)"/><ellipse cx="41" cy="16" rx="7" ry="9" transform="rotate(10 41 16)"/><ellipse cx="53" cy="28" rx="7" ry="9" transform="rotate(25 53 28)"/><path d="M18 41C22 37 25 30 32 30S42 37 46 41C55 51 45 58 38 54C34 52 30 52 26 54C18 58 9 51 18 41Z"/></g></svg></div><span className="mode-kicker">جاهز تكشف السرّ؟</span><h1>لعبة <em>الحيوانات</em></h1><p>حيوانك مخفي… خلّي أسئلتك تكشفه!</p></header>
    <section className="mode-selection" aria-labelledby="mode-title"><h2 id="mode-title">كيف تحب تلعب؟</h2><div className="mode-options">
      <Link className="mode-option mode-friends" to="/friends"><div className="mode-card-scene" aria-hidden="true"><div className="mode-halo"/><span className="mode-animal mode-fox">🦊</span><span className="mode-animal mode-lion">🦁</span><span className="mode-bubble">!</span><span className="mode-leaf">✦</span></div><div className="mode-card-copy"><h3>اللعب مع الأصدقاء</h3><span className="mode-cta">يلا نلعب <span aria-hidden="true">←</span></span></div></Link>
      <Link className="mode-option mode-bot" to="/ai"><div className="mode-card-scene" aria-hidden="true"><div className="mode-halo"/><span className="mode-animal mode-owl">🦉</span><span className="mode-secret">؟</span><span className="mode-bubble">…</span><span className="mode-leaf">✧</span></div><div className="mode-card-copy"><h3>اللعب ضد الذكاء الاصطناعي</h3><span className="mode-cta">ابدأ التحدّي <span aria-hidden="true">←</span></span></div></Link>
    </div></section><footer className="mode-home-footer">اسأل بذكاء · اكتشف بسرعة · احتفل بالفوز<button className="mode-motion-toggle" type="button" aria-label={paused?'تشغيل حركة الخلفية':'إيقاف حركة الخلفية'} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'▶':'Ⅱ'}</button></footer>
  </div></main>
}
