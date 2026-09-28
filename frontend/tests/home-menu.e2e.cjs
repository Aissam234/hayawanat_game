const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
const page=await browser.newPage();await page.goto('http://127.0.0.1:15178');
for(const width of [320,414,1280]){await page.setViewportSize({width,height:896});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.getByRole('link',{name:/اللعب مع الأصدقاء/}).getAttribute('href'),'/friends');assert.equal(await page.getByRole('link',{name:/اللعب ضد الذكاء الاصطناعي/}).getAttribute('href'),'/ai');}
await page.setViewportSize({width:414,height:896});
await page.getByRole('button',{name:'أدوات الصوت',exact:true}).click();await page.getByRole('button',{name:'إعدادات مستوى الصوت'}).click();await page.getByRole('slider',{name:'مستوى الموسيقى'}).fill('35');assert.equal(await page.getByRole('slider',{name:'مستوى الموسيقى'}).inputValue(),'35');
await page.keyboard.press('Escape');await page.locator('#sound-actions').waitFor({state:'detached'});assert.equal(await page.getByRole('button',{name:'أدوات الصوت',exact:true}).evaluate(el=>el===document.activeElement),true);
await page.getByRole('button',{name:'أدوات الصوت',exact:true}).click();await page.getByRole('heading',{name:'كيف تحب تلعب؟'}).click();await page.locator('#sound-actions').waitFor({state:'detached'});
await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.mode-fox').evaluate(el=>getComputedStyle(el).animationName),'none');
await page.screenshot({path:'C:/Users/issam/Documents/Codex/2026-09-20/files-pasted-by-the-user-you/home-new.png',fullPage:true});
console.log('PASS home layouts, links, sound expansion, volume, outside dismissal, Escape focus, reduced motion');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
