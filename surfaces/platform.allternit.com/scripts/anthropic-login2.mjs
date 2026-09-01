import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
const page=await ctx.newPage();
const urls=['https://platform.claude.com/login','https://clerk.claude.com/sign-in','https://clerk.claude.com/sign-up','https://console.anthropic.com/login'];
for(const u of urls){
  try{
    await page.goto(u,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(3000);
    console.log('URL:',page.url(),'TITLE:',await page.title());
    const text=await page.evaluate(()=>document.body.innerText.slice(0,800));
    console.log('BODY:',text.replace(/\n/g,' '));
    await page.screenshot({path:`surfaces/platform.allternit.com/screenshots/anthropic-${u.replace(/[^a-z0-9]/gi,'_')}.png`,fullPage:false});
  }catch(e){console.log('err',u,e.message);}
}
await browser.close();
