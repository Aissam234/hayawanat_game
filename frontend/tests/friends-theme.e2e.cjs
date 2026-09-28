const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
const page=await browser.newPage({viewport:{width:414,height:896},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const user={id:'u1',username:'tester',display_name:'صديق',avatar_id:'lion',total_score:3};
await page.route('**/api/**',route=>{const url=route.request().url();return route.fulfill({json:url.includes('/auth/me')?user:url.includes('/settings')?{}:{code:'ABCDE',status:'waiting',host_participant_id:'p1',participants:[{id:'p1',display_name:'صديق',role:'host',is_connected:true,score:3},{id:'p2',display_name:'ليلى',role:'audience',is_connected:true,score:0}]}})});
await page.goto('http://127.0.0.1:15178/friends');await page.getByRole('dialog').waitFor();
assert.equal(await page.locator('.friends-world').count(),1);
await page.evaluate(u=>{localStorage.setItem('auth_storage',JSON.stringify({state:{token:'fixture-only',user:u},version:0}));localStorage.setItem('hayawanat_session',JSON.stringify({guestUuid:'fixture',participantId:'p1',displayName:'صديق',roomCode:'ABCDE'}))},user);await page.reload();
await page.getByRole('button',{name:'✨ إنشاء غرفة',exact:true}).waitFor();
for(const width of [320,414,1280]){await page.setViewportSize({width,height:896});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const profile=await page.locator('.friends-profile').boundingBox();const back=await page.getByRole('button',{name:'← اختيار نمط اللعب'}).boundingBox();assert(profile.y+profile.height<=back.y,'profile must not overlap navigation');}
await page.setViewportSize({width:414,height:896});await page.screenshot({path:'C:/Users/issam/Documents/Codex/2026-09-20/files-pasted-by-the-user-you/friends-entry.png',fullPage:true});
await page.getByRole('button',{name:'✨ إنشاء غرفة',exact:true}).click();await page.getByPlaceholder('أدخل اسمك…').waitFor();
await page.goto('http://127.0.0.1:15178/lobby/ABCDE');await page.getByText('المشاركون (2)',{exact:false}).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'C:/Users/issam/Documents/Codex/2026-09-20/files-pasted-by-the-user-you/friends-lobby.png',fullPage:true});
await page.goto('http://127.0.0.1:15178/ai');await page.getByRole('button',{name:'🎮 ابدأ اللعب'}).waitFor();assert.equal(await page.locator('.friends-world').count(),0);assert.equal(await page.locator('.ai-world').count(),1);assert.deepEqual(errors,[]);
console.log('PASS mocked friends entry/auth/lobby, 320/414/1280 widths, create form, AI theme isolation; not a live multiplayer test');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
