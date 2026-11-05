(()=>{
 'use strict';
 const {shuffle,makeBoard,pick,cleanRecords,dayKey}=QuizCore;
 const $=id=>document.getElementById(id),questions=window.QUESTIONS,ids=questions.map(q=>q.id);
 let today=dayKey(),completed=[],memory={},queue=[],current,cards=[],selected=[],locked=false,timer,round=0;
 const key=()=>`star-memory-v1:${today}`;
 function read(){try{return cleanRecords(JSON.parse(localStorage.getItem(key())||'[]'),ids);}catch{ $('storageStatus').textContent='저장소를 사용할 수 없어요 · 이번 화면에서만 기록돼요';return memory[today]||[];}}
 function syncDay(){const date=dayKey();if(date!==today){today=date;completed=read();updateCount();}return today;}
 function updateCount(){$('count').textContent=`${completed.length} / 21`;}
 function save(){syncDay();completed=cleanRecords([...read(),...completed,current.id],ids);memory[today]=completed;try{localStorage.setItem(key(),JSON.stringify(completed));}catch{$('storageStatus').textContent='저장하지 못했어요 · 페이지를 닫으면 새 기록이 사라질 수 있어요';}updateCount();}
 function renderCards(wrong=-1){$('board').replaceChildren(...cards.map((letter,i)=>{const button=document.createElement('button');button.className='card';button.dataset.number=String(i+1).padStart(2,'0');const shown=selected.includes(i)||wrong===i;button.textContent=shown?letter:'✧';button.setAttribute('aria-label',shown?`${i+1}번 카드 ${letter}`:`${i+1}번 숨겨진 카드`);button.classList.toggle('revealed',selected.includes(i));button.classList.toggle('wrong',wrong===i);button.disabled=locked||selected.includes(i);button.onclick=()=>choose(i);return button;}));}
 function renderSlots(){$('slots').replaceChildren(...[...current.answer].map((_,i)=>{const span=document.createElement('span');span.className=`slot ${i<selected.length?'':'empty'} ${i===selected.length?'current':''}`;span.textContent=i<selected.length?cards[selected[i]]:'·';return span;}));}
 function choose(i){
  if(locked)return;syncDay();const result=pick(current.answer,cards,selected,i);if(result.status==='ignored')return;
  if(result.status==='wrong'){
   locked=true;renderCards(i);$('feedback').textContent='이 글자는 아니에요. 위치를 기억하고 처음부터!';
   timer=setTimeout(()=>{selected=[];locked=false;renderCards();renderSlots();$('feedback').textContent='같은 위치예요. 첫 글자부터 다시 찾아보세요.';},900);return;
  }
  selected=result.selected;
  if(result.status==='complete'){locked=true;save();$('feedback').textContent=`정답이에요! ${current.answer} ✦`;$('next').hidden=false;$('rule').hidden=true;}
  else $('feedback').textContent=`좋아요! ${selected.length+1}번째 글자를 찾아보세요.`;
  renderCards();renderSlots();
 }
 function next(){
  clearTimeout(timer);syncDay();
  if(!queue.length){queue=shuffle(questions.filter(q=>!completed.includes(q.id)));if(!queue.length)queue=shuffle(questions);round=0;}
  current=queue.pop();round++;cards=makeBoard(current.answer);selected=[];locked=false;
  $('category').textContent=current.category;$('progress').textContent=`${completed.length===21?'다시 복습':'탐구 중'} · ${round}번째`;
  $('question').textContent=current.question;$('feedback').textContent=`${current.answer.length}글자 정답을 순서대로 찾아보세요.`;
  $('next').hidden=true;$('rule').hidden=false;renderCards();renderSlots();
 }
 function showRecords(){syncDay();completed=cleanRecords([...read(),...completed],ids);updateCount();$('recordDate').textContent=today.replaceAll('-',' . ');$('recordCount').textContent=`${completed.length} / 21`;
  $('recordList').replaceChildren(...completed.map(id=>{const q=questions.find(q=>q.id===id),li=document.createElement('li'),answer=document.createElement('strong');li.append(document.createTextNode(q.question));answer.textContent=q.answer;li.append(answer);return li;}));$('emptyRecords').hidden=completed.length>0;if(!$('records').open)$('records').showModal();
 }
 $('next').onclick=next;$('recordsButton').onclick=showRecords;$('closeRecords').onclick=()=>$('records').close();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncDay();completed=cleanRecords([...read(),...completed],ids);updateCount();}});
 window.addEventListener('storage',event=>{if(event.key===key()){completed=cleanRecords([...read(),...completed],ids);updateCount();if($('records').open)showRecords();}});
 completed=read();updateCount();next();
})();
