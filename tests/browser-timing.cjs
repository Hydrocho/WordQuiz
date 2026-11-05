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
   const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:900}});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://**/*',route=>route.abort());
   await page.addInitScript(()=>localStorage.setItem('star-memory-sound','muted'));
   await page.clock.install({time:new Date('2026-11-05T10:00:00')});
   await page.clock.pauseAt(new Date('2026-11-05T10:00:01'));
   await page.goto(`http://127.0.0.1:${server.address().port}${prefix}/index.html`);
   assert.equal(await page.locator('#intro').isVisible(),true);
   assert.equal(await page.locator('#gameScreen').isVisible(),false);
   await page.clock.runFor(10000);
   assert.equal(await page.locator('#board .card').count(),0);
   assert.equal(await page.evaluate(()=>localStorage.getItem(`star-memory-timing-v1:${QuizCore.dayKey()}`)),null);
   for (const [width,height] of [[1280,720],[1024,600],[844,390],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.reload();
    const layout=await page.evaluate(()=>{
     const a=document.querySelector('.intro-brand').getBoundingClientRect();
     const b=document.querySelector('.intro-controls').getBoundingClientRect();
     const button=document.querySelector('#gameStart').getBoundingClientRect();
     return {columns:b.left>=a.right,bottom:button.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(layout.overflow,false);
    if(width>height){assert.equal(layout.columns,true);assert.ok(layout.bottom<=height,JSON.stringify({width,height,...layout}));}
   }
   await page.setViewportSize({width:1280,height:720});
   await page.screenshot({path:path.join(process.env.TEMP,'wordquiz-intro.png')});
   await page.locator('#gameStart').click();
   assert.equal(await page.locator('#intro').isVisible(),false);
   assert.equal(await page.locator('#gameScreen').isVisible(),true);
   await page.evaluate(()=>document.querySelector('#gameStart').onclick());
   assert.equal(await page.locator('#stageTag').textContent(),'STAGE 01');
   const solve=()=>page.evaluate(()=>{
    const q=QUESTIONS.find(q=>q.question===document.querySelector('#question').textContent);
    for(const ch of q.answer) {
     const button=[...document.querySelectorAll('.card')].find(b=>!b.disabled&&b.querySelector('.card-letter').textContent===ch);
     button.click();
    }
    return q.id;
   });
   const prepare=async()=>{
    await page.clock.runFor(1000);
    await page.locator('#ready').click();
    await page.clock.runFor(5000);
   };
   assert.equal(await page.locator('#next').isDisabled(),true);
   await page.clock.runFor(1000);
   assert.equal(await page.locator('.card.is-flipped').count(),0,'cards must wait for Ready');
   await solve();
   assert.equal(await page.locator('.card.is-matched').count(),0,'answers are locked before Ready');
   await page.locator('#ready').click();
   assert.equal(await page.locator('#ready').isDisabled(),true);
   await page.clock.runFor(110);
   assert.equal(await page.locator('.card.is-flipped').count(),2,'Ready starts the domino preview');
   await page.evaluate(()=>document.querySelector('#ready').onclick());
   await page.clock.runFor(4890);
   assert.equal(await page.locator('.card.is-flipped').count(),0,'preview finishes even after repeated activation');
   const first=await solve();
   assert.equal(await page.locator('#next').isDisabled(),false);
   await page.clock.runFor(4000);
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:00:10');
   await page.locator('#next').click();
   await prepare();
   const question=await page.locator('#question').textContent();
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   assert.equal(await page.locator('#question').textContent(),question);
   await prepare();
   const second=await solve();
   let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-timing-v1:${QuizCore.dayKey()}`)));
   assert.equal(saved.durations[first],6000);
   assert.equal(saved.durations[second],12000);
   for(let i=2;i<21;i++) {
    await page.locator('#next').click();
    await prepare();
    await solve();
   }
   saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-timing-v1:${QuizCore.dayKey()}`)));
   assert.equal(Object.keys(saved.durations).length,21);
   assert.equal(await page.locator('#completion').isVisible(),true);
   assert.equal(await page.locator('#completionGrade').textContent(),'S');
   assert.equal(await page.locator('#completionTime').textContent(),'00:02:16');
   await page.screenshot({path:path.join(process.env.TEMP,'wordquiz-completion.png')});
   await page.locator('#completionReview').click();
   assert.equal(saved.finishedAt-saved.startedAt,136000);
   await page.clock.runFor(5000);
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:02:16');
   await page.locator('#recordsButton').click();
   assert.equal(await page.locator('.rec-time').count(),21);
   assert.equal(await page.locator('#recordTotal').textContent(),'00:02:16');
   assert.equal(await page.locator('#recordGrade').textContent(),'S');
   assert.equal(await page.locator('.rec-time').first().textContent(),'풀이 시간: 00:00:06');
   await page.screenshot({path:path.join(process.env.TEMP,'wordquiz-timing-records.png')});
   await page.locator('#closeRecords').click();
   await page.locator('#next').click();
   await prepare();await solve();
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:02:16');
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:02:16');
   // A storage update from another tab must not replace this question's start.
   await page.evaluate(()=>localStorage.clear());
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   const activeId=await page.evaluate(()=>{
    const key=`star-memory-timing-v1:${QuizCore.dayKey()}`;
    const t=JSON.parse(localStorage.getItem(key));
    const original=t.active.id;
    t.active.id=QUESTIONS.find(q=>q.id!==original).id;
    localStorage.setItem(key,JSON.stringify(t));
    window.dispatchEvent(new StorageEvent('storage',{key}));
    return original;
   });
   await prepare();await solve();
   let record=await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-timing-v1:${QuizCore.dayKey()}`)));
   assert.equal(record.durations[activeId],6000,'another tab must not erase local question duration');
   // A solved screen left overnight must wait for the first new-day question.
   await page.clock.setSystemTime(new Date('2026-11-05T23:59:59'));
   await page.clock.runFor(6000);
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:00:00','new daily timer should not run on a solved screen');
   await page.locator('#next').click();await prepare();await solve();
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:00:06');
   // Legacy completion records retain IDs and explicitly have no timing.
   await page.evaluate(()=>{
    localStorage.setItem(`star-memory-v1:${QuizCore.dayKey()}`,JSON.stringify(QUESTIONS.map(q=>q.id)));
    localStorage.removeItem(`star-memory-timing-v1:${QuizCore.dayKey()}`);
   });
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();await page.locator('#recordsButton').click();
   assert.equal(await page.locator('#recordCount').textContent(),'21 / 21');
   assert.equal(await page.locator('#recordTotal').textContent(),'시간 기록 없음');
   assert.equal(await page.locator('.rec-time').first().textContent(),'풀이 시간: 시간 기록 없음');
   // Normal typewriter animation must finish before Ready is enabled.
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>localStorage.clear());
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   assert.equal(await page.locator('#ready').isDisabled(),true);
   await page.clock.runFor(5000);
   assert.equal(await page.locator('#ready').isDisabled(),false);
   assert.equal(await page.locator('.card.is-flipped').count(),0);
   await page.screenshot({path:path.join(process.env.TEMP,'wordquiz-ready.png')});
   await page.locator('#ready').click();
   await page.clock.runFor(5000);await solve();
   assert.equal(await page.locator('#next').isDisabled(),false);
   // Cancel leaves progress untouched. Confirm archives a finished attempt.
   const baseline=await page.evaluate(()=>{
    const date=QuizCore.dayKey();
    const timing={startedAt:Date.now()-90000,finishedAt:Date.now(),active:null,durations:Object.fromEntries(QUESTIONS.map(q=>[q.id,3000]))};
    localStorage.setItem(`star-memory-v1:${date}`,JSON.stringify(QUESTIONS.map(q=>q.id)));
    localStorage.setItem(`star-memory-timing-v1:${date}`,JSON.stringify(timing));
    return timing;
   });
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   page.once('dialog',dialog=>dialog.dismiss());
   await page.locator('#restartButton').click();
   assert.equal(await page.locator('#count').textContent(),'21 / 21');
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:01:30');
   page.once('dialog',dialog=>dialog.accept());
   await page.locator('#restartButton').click();
   assert.equal(await page.locator('#count').textContent(),'0 / 21');
   assert.equal(await page.locator('#stageTag').textContent(),'STAGE 01');
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:00:00');
   assert.equal(await page.locator('#scoreDisplay').textContent(),'000000');
   const archived=await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-history-v1:${QuizCore.dayKey()}`)));
   assert.deepEqual(archived[0].timing,baseline);
   assert.equal(archived[0].completed.length,21);
   await prepare();await solve();
   assert.equal(await page.locator('#count').textContent(),'1 / 21');
   await page.reload();await page.locator(await page.locator('#continueGame').isVisible() ? '#continueGame' : '#gameStart').click();
   assert.equal(await page.locator('#count').textContent(),'1 / 21');
   await page.locator('#recordsButton').click();
   assert.equal(await page.locator('.past-attempt').count(),1);
   assert.match(await page.locator('.past-attempt summary').textContent(),/전체 완료 · 00:01:30/);
   await page.locator('.past-attempt summary').click();
   assert.equal(await page.locator('.past-attempt li').count(),21);
   await page.locator('#closeRecords').click();
   // Restart during the hint must cancel callbacks from the old board.
   await page.clock.runFor(2000);await page.locator('#ready').click();
   await page.clock.runFor(220);
   page.once('dialog',dialog=>dialog.accept());await page.locator('#restartButton').click();
   await page.clock.runFor(6000);
   assert.equal(await page.locator('#count').textContent(),'0 / 21');
   assert.equal(await page.locator('.card.is-flipped').count(),0);
   assert.equal(await page.locator('#ready').isDisabled(),false);
   await solve();
   assert.equal(await page.locator('.card.is-matched').count(),0);
   // A failed archive must leave the ongoing attempt intact.
   const beforeFailedRestart=await page.locator('#elapsedDisplay').textContent();
   await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota');};});
   page.once('dialog',dialog=>dialog.accept());await page.locator('#restartButton').click();
   assert.match(await page.locator('#storageStatus').textContent(),/다시 도전을 시작하지 않았어요/);
   assert.equal(await page.locator('#elapsedDisplay').textContent(),beforeFailedRestart);
   await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
   // A new Game Start must not reuse a previous attempt's start time.
   await page.clock.runFor(60000);
   await page.reload();
   assert.equal(await page.locator('#continueGame').isVisible(),true);
   const historyBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-history-v1:${QuizCore.dayKey()}`)).length);
   await page.locator('#gameStart').click();
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:00:00');
   assert.equal(await page.locator('#count').textContent(),'0 / 21');
   assert.equal(await page.locator('#stageTag').textContent(),'STAGE 01');
   await page.clock.runFor(2000);
   assert.equal(await page.locator('#elapsedDisplay').textContent(),'00:00:02');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(`star-memory-history-v1:${QuizCore.dayKey()}`)).length),historyBefore+1);
   assert.deepEqual(errors,[]);
   console.log(`${prefix||'root'}: Ready gating, one-time preview, typewriter, all 21 answers, timing, reload, records and restart/archive passed`);
   await context.close();
  }
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

