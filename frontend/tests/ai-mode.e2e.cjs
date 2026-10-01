const {chromium}=require('playwright'),assert=require('node:assert/strict');
const path=require('node:path');
const url=process.env.TEST_URL||'http://127.0.0.1:15178';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const context=await browser.newContext({viewport:{width:414,height:896},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Math.random=()=>0});
  await page.goto(url);await page.waitForLoadState('networkidle');
  const requests=[],sockets=[];page.on('request',r=>requests.push(r.url()));page.on('websocket',ws=>sockets.push(ws.url()));
  await context.setOffline(true);
  await page.getByRole('link',{name:/اللعب ضد الذكاء الاصطناعي/}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByLabel('قوة الخصم').selectOption('hard');
  await page.getByRole('button',{name:'🎮 ابدأ اللعب'}).click();
  await page.getByRole('heading',{name:'كلب منزلي',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'قطة منزلية',exact:true}).count(),0);
  await page.getByTestId('hidden-own').waitFor();
  assert.equal(await page.locator('#ai-question-prefix').innerText(),'هاد الحيوان عندي…');
  assert.match(await page.getByLabel('💬 اسأل بطريقتك').getAttribute('placeholder'),/كيسبح/);
  await page.getByLabel('💬 اسأل بطريقتك').fill('هل أحب البيتزا؟');
  await page.getByRole('button',{name:'💬 أرسل سؤالي'}).click();
  await page.getByText(/هاد الصفة مازال/).waitFor();
  await page.getByRole('heading',{name:'🎯 دورك — اسأل أو خمن'}).waitFor();
  await page.getByLabel('💬 اسأل بطريقتك').fill('واش كيعيش فالبحر؟');
  await page.getByRole('button',{name:'💬 أرسل سؤالي'}).click();
  await page.getByText(/كتقصد واش الماء/).waitFor();
  await page.getByLabel('💬 اسأل بطريقتك').fill('واش هو من الثدييات؟');
  await page.getByRole('button',{name:'💬 أرسل سؤالي'}).click();
  await page.getByText('فهمت سؤالك بهذا المعنى:',{exact:true}).waitFor();
  await page.getByRole('button',{name:'نعم، اسأل بهذا المعنى'}).click();
  await page.getByRole('heading',{name:'🤖 سؤال الخصم',exact:true}).waitFor();
  // Resolve the actual selected question against the visible opponent card.
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:'🤖 سؤال الخصم',exact:true})});
  const question=await section.locator('p.text-lg').innerText();
  const fs=require('node:fs'),ts=require('typescript');
  require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
  const engine=require('../src/features/ai-mode/engine.ts');
  const answer=engine.questions.find(q=>engine.formatQuestion(q.text)===question).test(engine.getAnimal(2));
  await section.getByRole('button',{name:answer?'✅ نعم':'❌ لا',exact:true}).click();
  await page.getByRole('button',{name:'🎯 عرفت حيواني'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'🐱 قطة منزلية',exact:true}).click();
  await page.getByRole('button',{name:'تأكيد التخمين'}).click();
  await page.getByRole('heading',{name:'🏆 لقد فزت!'}).waitFor();
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'arena-victory.png'),fullPage:true});
  assert.match(await page.getByLabel('نتيجة الجلسة').innerText(),/أنت\s*1/);
  await page.getByLabel('مدة الجولة').selectOption('20');
  await page.getByRole('button',{name:'🔄 جولة جديدة'}).click();
  assert.match(await page.getByLabel('نتيجة الجلسة').innerText(),/أنت\s*1/);
  for(const width of [320,414,1280]){
    await page.setViewportSize({width,height:896});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,`offline-ai-${width}.png`),fullPage:true});
  }
  await page.getByRole('heading',{name:'⏳ انتهى الوقت — تعادل'}).waitFor({timeout:25000});
  await page.getByRole('link',{name:'🏠 العودة للقائمة'}).click();
  // Even a saved account must not trigger an auth refresh in local mode.
  await page.evaluate(()=>{localStorage.setItem('auth_storage',JSON.stringify({state:{token:'expired-offline-test',user:{username:'offline',avatar_id:'lion',total_score:0}},version:0}));window.dispatchEvent(new Event('focus'))});
  await page.getByRole('link',{name:/اللعب ضد الذكاء الاصطناعي/}).click();
  assert.equal(await page.getByRole('button',{name:'🔄 جولة جديدة'}).isVisible(),true);
  assert.deepEqual(requests,[]);assert.deepEqual(sockets,[]);assert.deepEqual(errors,[]);
  const saved=await browser.newContext();
  await saved.addInitScript(()=>localStorage.setItem('auth_storage',JSON.stringify({state:{token:'expired-offline-test',user:{username:'offline',avatar_id:'lion',total_score:0}},version:0})));
  const direct=await saved.newPage(), forbidden=[];
  direct.on('request',r=>{if(r.url().includes('/api/')||!r.url().startsWith(url))forbidden.push(r.url())});
  direct.on('websocket',ws=>forbidden.push(ws.url()));
  await direct.goto(url+'/ai');await direct.waitForLoadState('networkidle');
  await direct.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await saved.setOffline(true);
  await direct.getByRole('button',{name:'🎮 ابدأ اللعب'}).click();
  await direct.getByTestId('hidden-own').waitFor();
  assert.deepEqual(forbidden,[]);await saved.close();
  console.log('PASS: production build loaded, connection disabled before AI entry, 0 requests/0 WebSockets, guest play, privacy, structured question/AI answer, human answer, win, rematch/score, local timer, 320/414/1280px, offline navigation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
