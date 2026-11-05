(function(root){
 'use strict';
 const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 function makeBoard(answer){const a=[...answer],pool=[...'별우주은하성단온도빛청적색공전시차팽창구상산개암흑반사발광'];while(a.length<20)a.push(pool[Math.floor(Math.random()*pool.length)]);return shuffle(a);}
 function pick(answer,cards,selected,index){
  if(selected.includes(index)||index<0||index>=cards.length)return {selected,status:'ignored'};
  if(cards[index]!==[...answer][selected.length])return {selected:[],status:'wrong'};
  const next=[...selected,index];return {selected:next,status:next.length===[...answer].length?'complete':'correct'};
 }
 const cleanRecords=(value,ids)=>Array.isArray(value)?[...new Set(value.filter(id=>ids.includes(id)))]:[];
 const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const api={shuffle,makeBoard,pick,cleanRecords,dayKey};
 if(typeof module!=='undefined')module.exports=api;else root.QuizCore=api;
})(globalThis);
