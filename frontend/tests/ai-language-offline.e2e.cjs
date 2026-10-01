const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const e=require('../src/features/ai-mode/engine.ts');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const context=await browser.newContext({viewport:{width:414,height:896},reducedMotion:'reduce'}),page=await context.newPage(),network=[],errors=[];
 await page.addInitScript(()=>{Math.random=()=>0});page.on('pageerror',err=>errors.push(err.message));
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:15178')+'/ai');await page.waitForLoadState('networkidle');
 page.on('request',r=>network.push(r.url()));page.on('websocket',w=>network.push(w.url()));await context.setOffline(true);
 await page.getByLabel('قوة الخصم').selectOption('hard');await page.getByRole('button',{name:'🎮 ابدأ اللعب'}).click();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('hayawanat.ai-round.v1')).round);
 async function answer(){await page.getByRole('heading',{name:'🤖 سؤال الخصم',exact:true}).waitFor();const r=await saved(),yes=e.getQuestion(r.pending).test(e.getAnimal(r.aiSecret));await page.getByRole('button',{name:yes?'✅ نعم':'❌ لا',exact:true}).click();await page.getByRole('heading',{name:'🎯 دورك — اسأل أو خمن'}).waitFor()}
 for(const text of ['هل أنا من الثدييات؟','واش كنسبح؟','wach 3ndi 9ron?']){
  await page.getByLabel('💬 اسأل بطريقتك').fill(text);await page.getByRole('button',{name:'💬 أرسل سؤالي'}).click();await page.getByRole('button',{name:'نعم، اسأل بهذا المعنى'}).click();await answer();
 }
 const count=(await saved()).history.length;
 await page.getByLabel('💬 اسأل بطريقتك').fill('wach kan3om?');await page.getByRole('button',{name:'💬 أرسل سؤالي'}).click();await page.getByRole('button',{name:'نعم، اسأل بهذا المعنى'}).click();await page.getByText(/سبق سولتي/).waitFor();assert.equal((await saved()).history.length,count);
 await page.getByLabel('💬 اسأل بطريقتك').fill('wach kan3ich f lb7er?');await page.getByRole('button',{name:'💬 أرسل سؤالي'}).click();await page.getByText(/كتقصد واش الماء/).waitFor();assert.equal((await saved()).history.length,count);
 await page.getByLabel('💬 اسأل بطريقتك').fill('wach kanakol l7em?');
 await page.getByRole('link',{name:'🏠 العودة للقائمة'}).click();await page.getByRole('link',{name:/اللعب ضد الذكاء الاصطناعي/}).click();assert.equal((await saved()).history.length,count);assert.equal(await page.getByLabel('💬 اسأل بطريقتك').inputValue(),'wach kanakol l7em?');
 for(let i=0;i<30;i++){
  let r=await saved();if(r.phase==='finished')break;
  if(r.phase==='human'){
   await page.getByRole('button',{name:'🎯 عرفت حيواني'}).click();await page.getByRole('dialog').getByRole('button',{name:'🐶 كلب منزلي',exact:true}).click();await page.getByRole('button',{name:'تأكيد التخمين'}).click();
  }
  await page.waitForFunction(()=>['ai-question','human','finished'].includes(JSON.parse(localStorage.getItem('hayawanat.ai-round.v1')).round.phase));
  r=await saved();if(r.phase==='ai-question')await answer();
 }
 await page.getByRole('heading',{name:'🤖 الذكاء الاصطناعي فاز'}).waitFor();assert.equal((await saved()).scores.ai,1);
 await page.getByRole('button',{name:'🔄 جولة جديدة'}).click();assert.equal((await saved()).scores.ai,1);assert.equal((await saved()).history.length,0);
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);console.log('PASS offline Arabic/Darija/Arabizi, repeated meaning, ambiguity, local persistence, full AI win, rematch: ZERO requests/sockets');
 }finally{await browser.close()}})().catch(err=>{console.error(err);process.exit(1)});
