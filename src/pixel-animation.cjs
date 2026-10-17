'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {ROOT,inside}=require('./project.cjs');
function frameIndex(t,{fps=12,frames=24}={}){
  if(!Number.isFinite(t))throw Error('time must be finite');
  if(!Number.isFinite(fps)||fps<=0||!Number.isInteger(frames)||frames<1)throw Error('Invalid timing metadata');
  const duration=frames/fps;if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid timing metadata');
  const scaled=(t%duration)*fps,nearest=Math.round(scaled);
  const index=Math.abs(scaled-nearest)<=8*Number.EPSILON*Math.max(frames,Math.abs(scaled))?nearest:Math.floor(scaled);
  return ((index%frames)+frames)%frames;
}
async function createPixelAnimation({character='shoga',variant,action='idle',size=256}={}){
  if(typeof character!=='string'||typeof action!=='string')throw Error('character and action must be string IDs');
  if(variant!==undefined&&typeof variant!=='string')throw Error('variant must be a string ID');
  if(!Number.isInteger(size)||size<64||size>2048)throw Error('size must be 64..2048');
  const manifest=JSON.parse(fs.readFileSync(inside(ROOT,'assets/pixel/manifest.json'),'utf8'));
  if(Object.hasOwn(manifest.aliases||{},character))character=manifest.aliases[character];
  if(!Object.hasOwn(manifest.characters,character))throw Error('Unknown pixel character');
  if(!Object.hasOwn(manifest.motions,action))throw Error('Unknown pixel action');
  let entry=manifest.characters[character];
  if(variant!==undefined){
    if(!Object.hasOwn(manifest.variants||{},variant)||manifest.variants[variant].parent!==character)throw Error('Unknown pixel variant for character');
    entry=manifest.variants[variant];
  }
  const metadata=entry.animations[action];
  const filename=inside(ROOT,'assets/pixel/'+metadata.sheet),sheet=await loadImage(filename);
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  function frame(t){const i=frameIndex(t,manifest);ctx.clearRect(0,0,size,size);
    ctx.drawImage(sheet,(i%manifest.columns)*manifest.size,Math.floor(i/manifest.columns)*manifest.size,manifest.size,manifest.size,0,0,size,size);return canvas;}
  return {canvas,frame,metadata:{...metadata,character,...(variant!==undefined?{variant}:{}),action,size,sourceSize:manifest.size}};
}
module.exports={createPixelAnimation,frameIndex};
