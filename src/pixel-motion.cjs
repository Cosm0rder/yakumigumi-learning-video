'use strict';
// Timeline animation of supplied artwork. Expressions are drawn source poses.
// This renderer never redraws eyes, mouths, or limbs.
const {createCanvas}=require('@napi-rs/canvas');
const motions={idle:'待機',blink:'まばたき',walk:'歩行 / 移動',cheer:'喜ぶ',surprise:'驚く',worry:'困る',think:'考える',talk:'話す',point:'指さす / 説明',bow:'おじぎ'};
const size=256,fps=12,frames=24,columns=6,rows=4;
function renderMotion(base,rig,action,index,keyposes){
  if(!Object.hasOwn(motions,action))throw Error('Unknown pixel action');
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  let drawn=base;
  if(keyposes){let active=index>=3&&index<=21;
    if(action==='idle')active=false;
    if(action==='blink')active=index>=9&&index<=13;
    if(action==='walk')active=Math.floor(index/6)%2===1;
    if(action==='talk')active=Math.floor(index/3)%2===1;
    drawn=keyposes[active?action:'idle'];
  }
  const p=index/frames,s=Math.sin(p*Math.PI*2),pulse=Math.sin(p*Math.PI*4);
  let dx=0,dy=0,rotation=0,sx=1,sy=1;
  if(action==='idle'){sy=1+Math.max(0,s)*.016;dy=-Math.round(Math.max(0,s));}
  if(action==='walk'){dy=-Math.round(Math.abs(pulse)*12/4)*4;dx=Math.round(s*4/4)*4;rotation=pulse*.055;}
  if(action==='cheer'){dy=-Math.round(Math.max(0,pulse)*32/4)*4;rotation=s*.065;sx=1+Math.min(0,pulse)*.045;sy=1-Math.min(0,pulse)*.06;}
  if(action==='surprise'){const jump=index<8?Math.sin(index/8*Math.PI):0;dy=-Math.round(jump*16/4)*4;sx=1-jump*.035;sy=1+jump*.025;}
  if(action==='worry'){dx=Math.round(Math.sin(p*Math.PI*8)*4/4)*4;rotation=-.055+s*.02;sy=.98;}
  if(action==='think'){rotation=Math.sin(p*Math.PI)**2*.105;dy=-Math.round(Math.max(0,s)*4/4)*4;}
  if(action==='talk'){const pulse=Math.abs(Math.sin(p*Math.PI*8));sy=1+pulse*.02;dy=-Math.round(pulse*4/4)*4;}
  if(action==='point'){const lean=Math.sin(p*Math.PI)**2;rotation=-lean*.07;dx=Math.round(lean*8/4)*4;}
  if(action==='bow'){const bend=Math.sin(p*Math.PI)**2;rotation=bend*.16;sy=1-bend*.12;dx=Math.round(bend*8/4)*4;}
  const anchor=rig.anchor||[128,240];ctx.save();ctx.translate(anchor[0]+dx,anchor[1]+dy);ctx.rotate(rotation);ctx.scale(sx,sy);ctx.drawImage(drawn,-anchor[0],-anchor[1]);ctx.restore();
  return canvas;
}
module.exports={motions,size,fps,frames,columns,rows,renderMotion};
