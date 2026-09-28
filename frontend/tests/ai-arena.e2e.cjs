const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:414,height:896}});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:15178')+'/ai');
  await page.waitForLoadState('networkidle');
  for(const width of [320,414,1280]){
   await page.setViewportSize({width,height:896});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
   assert(await page.getByRole('button',{name:'🎮 ابدأ اللعب'}).isVisible());
   if(width<=700)assert((await page.locator('.ai-setup').boundingBox()).width>=width-30,'setup fills mobile width');
   if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,`arena-setup-${width}.png`),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.ai-rival').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.getByRole('button',{name:'🎮 ابدأ اللعب'}).click();
  await page.setViewportSize({width:414,height:896});
  assert((await page.locator('.ai-opponent').boundingBox()).width>=384,'opponent fills mobile width');
  await page.getByLabel('💬 اسأل بطريقتك').fill('واش كيسبح؟');
  assert.equal(await page.getByLabel('💬 اسأل بطريقتك').evaluate(el=>getComputedStyle(el).fontSize),'16px','avoid iOS input zoom');
  await page.getByRole('button',{name:'🎯 عرفت حيواني'}).click();
  const dialog=page.getByRole('dialog');
  assert(await dialog.isVisible());
  assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(),false);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'arena-play-414.png'),fullPage:true});
  console.log('PASS arena: 320/414/1280 setup layouts, reduced motion, 16px input, dialog focus and Escape');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
