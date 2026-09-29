'use strict';
const actions=['idle','wave','nod','think','point','cheer','walk','surprise'];
const labels={idle:'待つ',wave:'手を振る',nod:'うなずく',think:'考える',point:'指さして説明',cheer:'喜ぶ',walk:'歩く',surprise:'驚く'};
function pose(action,t,size){
  if(!actions.includes(action))throw Error('Unknown character action');
  const cycle=t%2, p=cycle/2, sin=Math.sin(2*Math.PI*p);
  const result={pose:'idle',walk:false,hop:0,rot:0,shadow:false,mute:true,bubble:false};
  if(action==='wave'){result.pose='wave';result.rot=sin*.075;}
  if(action==='nod'){result.pose=cycle<.85?'crouch':'idle';result.hop=-Math.max(0,Math.sin(cycle*Math.PI*2))*size*.018;}
  if(action==='think'){result.pose='think';result.rot=sin*.035;}
  if(action==='point'){result.pose='point';result.rot=sin*.018;}
  if(action==='cheer'){result.pose=cycle<.4?'crouch':cycle<1.3?'jump':'cheer';result.hop=Math.max(0,Math.sin((cycle-.4)/.9*Math.PI))*((cycle>=.4&&cycle<=1.3)?size*.14:0);}
  if(action==='walk'){result.walk=true;}
  if(action==='surprise'){result.pose=cycle<1.15?'arms':'idle';result.hop=cycle<.5?Math.sin(cycle/.5*Math.PI)*size*.1:0;}
  return result;
}
module.exports={actions,labels,pose};

