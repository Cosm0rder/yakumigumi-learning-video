'use strict';
// Integer pixel-center sampling, with explicit choices only at exact ties.
function nearestAxis(sourceSize,targetSize,lowerTies=[]){
  if(![sourceSize,targetSize].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isSafeInteger(2*sourceSize*targetSize))throw new RangeError('Invalid nearest-neighbor dimensions');
  if(!Array.isArray(lowerTies))throw new TypeError('Nearest boundary choices must be an array');
  let previous=-1;
  for(const index of lowerTies){
    if(!Number.isInteger(index)||index<=previous||index<0||index>=targetSize||(2*index+1)*sourceSize%(2*targetSize)!==0)throw new RangeError('Lower sample is allowed only at a distinct, sorted exact boundary');
    previous=index;
  }
  const lower=new Set(lowerTies);
  return Array.from({length:targetSize},(_,index)=>Math.floor((2*index+1)*sourceSize/(2*targetSize))-(lower.has(index)?1:0));
}
function sampleNearestRgba(source,sourceWidth,sourceHeight,targetWidth,targetHeight,ties){
  if(!ties||typeof ties!=='object'||Object.keys(ties).sort().join(',')!=='x,y')throw new TypeError('Explicit X/Y boundary choices are required');
  const xs=nearestAxis(sourceWidth,targetWidth,ties.x),ys=nearestAxis(sourceHeight,targetHeight,ties.y);
  if(!(source instanceof Uint8Array||source instanceof Uint8ClampedArray)||source.length!==sourceWidth*sourceHeight*4)throw new TypeError('Source must contain exact RGBA bytes');
  const output=new Uint8ClampedArray(targetWidth*targetHeight*4);
  for(let y=0;y<targetHeight;y++)for(let x=0;x<targetWidth;x++){
    const from=(ys[y]*sourceWidth+xs[x])*4,to=(y*targetWidth+x)*4;
    output.set(source.subarray(from,from+4),to);
  }
  return output;
}
module.exports={nearestAxis,sampleNearestRgba};
