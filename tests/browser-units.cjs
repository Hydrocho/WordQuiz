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
 for(const prefix of ['', '/star-memory/dist']) {
 const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:720}});
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.clock.install({time:new Date('2026-11-11T10:00:00')});
 await page.clock.pauseAt(new Date('2026-11-11T10:00:01'));
 await page.goto(`http://127.0.0.1:${server.address().port}${prefix}/index.html`);
 await page.evaluate(()=>{localStorage.setItem('star-memory-sound','muted');localStorage.setItem(`star-memory-v1:${QuizCore.dayKey()}`,'[1,2]');});
 await page.reload();
 assert.equal(await page.locator('#unitSelect option').count(),2);
 for(const [width,height] of [[1280,720],[844,390],[390,844]]) {
 await page.setViewportSize({width,height}); await page.reload();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(width>height) assert.ok(await page.locator('#gameStart').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
 }
 await page.setViewportSize({width:1280,height:720});
 await page.locator('#unitSelect').selectOption('8');
 await page.locator('#gameStart').click();
 assert.equal(await page.locator('#count').textContent(),'0 / 23');
 const seen=new Set();
 for(let i=0;i<23;i++) {
 await page.clock.runFor(1000);
 const question=await page.locator('#question').textContent();
 assert.match(question,/\(\d{3}쪽\)$/);
 assert.equal(question,await page.evaluate(index=>UNITS[1].questions[index].question,i),'unit 8 must follow question number order');
 assert.ok(!seen.has(question));seen.add(question);
 await page.locator('#ready').click(); await page.clock.runFor(5000);
 await page.evaluate(()=>{
 const q=UNITS[1].questions.find(q=>q.question===document.querySelector('#question').textContent);
 for(const ch of q.answer) [...document.querySelectorAll('.card')].find(b=>!b.disabled && b.querySelector('.card-letter').textContent===ch).click();
 });
 if(i<22) {await page.locator('#next').click();}
 }
 await page.clock.runFor(2000);
 assert.equal(await page.locator('#completion').isVisible(),true);
 assert.equal(await page.locator('#completionKicker').textContent(),'8. 과학 기술과 인류 문명');
 assert.equal(await page.evaluate(()=>localStorage.getItem(`star-memory-v1:${QuizCore.dayKey()}`)),'[1,2]');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-v1:${QuizCore.dayKey()}:unit-8`)).length),23);
 await page.locator('#completionRecords').click();
 assert.equal(await page.locator('#recordList li').count(),23);
 assert.match(await page.locator('#recordList').textContent(),/\(295쪽\)/);
 await page.reload();await page.locator('#unitSelect').selectOption('8');await page.locator('#gameStart').click();
 assert.equal(await page.locator('#count').textContent(),'0 / 23');
 await page.locator('#recordsButton').click();
 assert.equal(await page.locator('.past-attempt').count(),1);
 assert.deepEqual(errors,[]);
 await context.close();
 console.log(prefix || 'root', 'unit selection, 23 answers, pages, storage isolation, completion and restart passed');
 }
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
