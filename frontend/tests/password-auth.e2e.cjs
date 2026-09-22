const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const username='browser_'+Date.now(), password='test-password-123';
  await page.goto('http://127.0.0.1:15173');
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'لا تملك حساباً؟ سجل الآن'}).click();
  await page.getByLabel('اسم المستخدم',{exact:true}).fill(username);
  await page.getByLabel('كلمة المرور',{exact:true}).fill(password);
  await page.getByLabel('تأكيد كلمة المرور',{exact:true}).fill('different');
  await page.getByRole('button',{name:'حساب جديد',exact:true}).click();
  await page.getByText('كلمتا المرور غير متطابقتين',{exact:true}).waitFor();
  await page.getByLabel('تأكيد كلمة المرور',{exact:true}).fill(password);
  await page.getByRole('button',{name:'حساب جديد',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByText(username,{exact:true}).waitFor();
  await page.reload();
  await page.getByText(username,{exact:true}).waitFor();
  await page.getByTitle('تسجيل الخروج').click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('اسم المستخدم',{exact:true}).fill(username);
  await page.getByLabel('كلمة المرور',{exact:true}).fill('wrong');
  await page.getByRole('button',{name:'دخول',exact:true}).click();
  await page.getByText('اسم المستخدم أو كلمة المرور غير صحيحة',{exact:true}).waitFor();
  await page.getByLabel('كلمة المرور',{exact:true}).fill(password);
  await page.getByRole('button',{name:'دخول',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('script[src*="google.com"]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: register, confirmation mismatch, profile persistence, logout, wrong password, login, mobile layout, no Google SDK, no browser errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
