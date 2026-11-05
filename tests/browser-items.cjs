// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright module.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{
 const file=path.join(root,decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404).end();}
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  for(const base of ['', '/star-memory/dist']) {
   const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://**/*',r=>r.abort());
   await page.clock.install({time:new Date('2026-11-06T10:00:00')});await page.clock.pauseAt(new Date('2026-11-06T10:00:01'));
   await page.goto(`http://127.0.0.1:${server.address().port}${base}/index.html`);
   await page.evaluate(()=>{
    localStorage.setItem('star-memory-sound','muted');
    localStorage.setItem(`star-memory-items-v1:${QuizCore.dayKey()}`,JSON.stringify({inventory:['reveal','hint','erase'],used:0,awarded:[]}));
   });
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   assert.equal(await page.locator('.item-button:disabled').count(),3);
   await page.locator('#ready').click();await page.clock.runFor(5000);
   assert.equal(await page.locator('.item-button:not(:disabled)').count(),3);
   await page.screenshot({path:path.join(process.env.TEMP,'wordquiz-items.png')});
   await page.locator('.item-button.reveal').click();
   assert.equal(await page.locator('.card.is-flipped').count(),20);
   assert.equal(await page.locator('.item-button:not(:disabled)').count(),0);
   await page.clock.runFor(2480);
   assert.equal(await page.locator('.card.is-flipped').count(),0);
   await page.locator('.item-button.hint').click();
   assert.equal(await page.locator('.card.item-revealed').count(),1);
   assert.equal(await page.locator('.card.is-matched').count(),0);
   await page.clock.runFor(2480);
   await page.locator('.item-button.erase').click();
   assert.equal(await page.locator('.card.is-erased').count(),3);
   assert.equal(await page.locator('#itemCount').textContent(),'0 / 3');
   assert.equal(await page.evaluate(()=>{
    const q=QUESTIONS.find(q=>q.question===document.querySelector('#question').textContent);
    return [...document.querySelectorAll('.is-erased .card-letter')].every(el=>!q.answer.includes(el.textContent));
   }),true);
   const usage=await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-items-v1:${QuizCore.dayKey()}`)));
   assert.equal(usage.used,3);
   await page.locator('#recordsButton').click();assert.equal(await page.locator('#recordItems').textContent(),'이번 도전 아이템 사용 3회');await page.locator('#closeRecords').click();
   await page.evaluate(()=>{
    Math.random=()=>0;
    const q=QUESTIONS.find(q=>q.question===document.querySelector('#question').textContent);
    for(const ch of q.answer)[...document.querySelectorAll('.card')].find(b=>!b.disabled&&b.querySelector('.card-letter').textContent===ch).click();
   });
   assert.equal(await page.locator('#itemCount').textContent(),'1 / 3');
   assert.equal(await page.locator('.item-button:not(:disabled)').count(),0);
   await page.locator('#next').click();await page.locator('#ready').click();await page.clock.runFor(5000);
   assert.equal(await page.locator('.card.is-erased').count(),0);
   await page.locator('.item-button.reveal').click();
   page.once('dialog',d=>d.accept());await page.locator('#restartButton').click();
   await page.clock.runFor(5000);
   assert.equal(await page.locator('#itemCount').textContent(),'0 / 3');
   assert.equal(await page.locator('.card.is-flipped').count(),0);
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   await page.locator('#recordsButton').click();assert.match(await page.locator('.past-attempt summary').textContent(),/아이템 4회/);
   assert.deepEqual(errors,[]);
   console.log(base||'root','all three item effects, gating, random reward, usage, archive and restart passed');
   await context.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
