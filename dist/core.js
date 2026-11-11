(function(root){
 'use strict';
 const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const POOL=[...new Set([...'별우주은하성단온도빛청적색공전시차팽창구상산개암흑반사발광태양행성궤도중력혜성위성대기스펙트럼망원경인력진화밀도거리관측초신성성운파장질량광도코로나흑점플레어은하수안드로메다오리온북극성북두칠성카시오페이아'])];
 function makeBoard(answer){
  const answerChars=[...answer],a=[...answerChars],answerSet=new Set(answerChars);
  const candidates=shuffle(POOL.filter(ch=>!answerSet.has(ch)));
  for(const ch of candidates){if(a.length>=20)break;a.push(ch);}
  let fallback=0;while(a.length<20){a.push(POOL[fallback%POOL.length]);fallback++;}
  return shuffle(a);
 }
 function pick(answer,cards,selected,index){
  if(selected.includes(index)||index<0||index>=cards.length)return {selected,status:'ignored'};
  if(cards[index]!==[...answer][selected.length])return {selected:[],status:'wrong'};
  const next=[...selected,index];return {selected:next,status:next.length===[...answer].length?'complete':'correct'};
 }
 const cleanRecords=(value,ids)=>Array.isArray(value)?[...new Set(value.filter(id=>ids.includes(id)))]:[];
 const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const validTime=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
 function cleanTiming(value,ids){
  const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const startedAt=validTime(raw.startedAt)?raw.startedAt:null;
  const finishedAt=startedAt!==null&&validTime(raw.finishedAt)&&raw.finishedAt>=startedAt?raw.finishedAt:null;
  const durations={};
  for(const id of ids) if(validTime(raw.durations?.[id])) durations[id]=raw.durations[id];
  const active=finishedAt===null&&startedAt!==null&&ids.includes(raw.active?.id)&&validTime(raw.active?.startedAt)&&raw.active.startedAt>=startedAt
   ?{id:raw.active.id,startedAt:raw.active.startedAt}:null;
  return {startedAt,finishedAt,active,durations};
 }
 function beginTiming(timing,id,now){
  if(timing.finishedAt!==null)return timing;
  return {...timing,startedAt:timing.startedAt??now,
   active:timing.active?.id===id?timing.active:{id,startedAt:now}};
 }
 function finishTiming(timing,id,now,allCompleted){
  if(timing.finishedAt!==null)return timing;
  const durations={...timing.durations};
  if(durations[id]===undefined&&timing.active?.id===id)
   durations[id]=Math.max(0,now-timing.active.startedAt);
  return {...timing,durations,active:null,finishedAt:allCompleted?Math.max(timing.startedAt??now,now):null};
 }
 const elapsedTiming=(timing,now)=>timing.startedAt===null?0:Math.max(0,(timing.finishedAt??now)-timing.startedAt);
 function formatDuration(ms){
  const seconds=Math.floor(Math.max(0,ms)/1000);
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
 }
 const GRADE_LIMITS=[['S',7],['A',10],['B',14],['C',18]];
 function gradeLimits(questionCount){
  const sMinutes=Math.max(1,Math.round(questionCount/3));
  // Keep other cutoffs; omit empty ranges if a future unit has a longer S limit.
  return [['S',sMinutes],...GRADE_LIMITS.slice(1).filter(([,minutes])=>minutes>sMinutes)];
 }
 function completionGrade(completed,timing,ids){
  if(cleanRecords(completed,ids).length!==ids.length || !ids.length || timing.startedAt===null || timing.finishedAt===null || !ids.every(id=>validTime(timing.durations[id])))return null;
  const elapsed=elapsedTiming(timing,timing.finishedAt);
  return gradeLimits(ids.length).find(([,minutes])=>elapsed<=minutes*60000)?.[0]??'D';
 }
 const ITEM_TYPES=['reveal','hint','erase'];
 function cleanItems(raw,ids){
  return {inventory:Array.isArray(raw?.inventory)?raw.inventory.filter(x=>ITEM_TYPES.includes(x)).slice(0,3):[],
   used:Number.isSafeInteger(raw?.used)&&raw.used>=0?raw.used:0,awarded:cleanRecords(raw?.awarded,ids)};
 }
 function awardItem(state,id,roll,typeRoll){
  if(state.awarded.includes(id))return {state,item:null};
  const next={...state,inventory:[...state.inventory],awarded:[...state.awarded,id]};
  const item=next.inventory.length<3&&roll<0.5?ITEM_TYPES[Math.min(2,Math.max(0,Math.floor(typeRoll*3)))]:null;
  if(item)next.inventory.push(item);
  return {state:next,item};
 }
 const api={shuffle,makeBoard,pick,cleanRecords,dayKey,cleanTiming,beginTiming,finishTiming,elapsedTiming,formatDuration,completionGrade,GRADE_LIMITS,gradeLimits,cleanItems,awardItem};
 if(typeof module!=='undefined')module.exports=api;else root.QuizCore=api;
})(globalThis);
