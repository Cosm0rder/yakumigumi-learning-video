'use strict';
// Offline MP4 example using the new sprite sheets. No services or API keys.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const {createPixelAnimation}=require('../src/pixel-animation.cjs');
const {ROOT,inside,run}=require('../src/project.cjs');
async function main(){
  const character=process.argv[2]||'shoga';const manifest=JSON.parse(fs.readFileSync(inside(ROOT,'assets/pixel/manifest.json'),'utf8'));
  const animations=await Promise.all(Object.keys(manifest.motions).map(action=>createPixelAnimation({character,action,size:256})));
  const width=1280,height=720,fps=24,seconds=4,cv=createCanvas(width,height),ctx=cv.getContext('2d'),raw=[];
  for(let i=0;i<fps*seconds;i++){ctx.fillStyle='#18283b';ctx.fillRect(0,0,width,height);ctx.fillStyle='#faf1d8';ctx.font='24px sans-serif';ctx.textAlign='center';
    animations.forEach((anim,k)=>{const x=24+(k%5)*252,y=50+Math.floor(k/5)*320;anim.frame(i/fps);ctx.drawImage(anim.canvas,x,y,232,232);ctx.fillText(Object.keys(manifest.motions)[k],x+116,y+270);});
    raw.push(Buffer.from(ctx.getImageData(0,0,width,height).data));}
  fs.mkdirSync(path.join(ROOT,'output'),{recursive:true});inside(ROOT,'output');const out=path.join(ROOT,'output','pixel-demo.mp4');if(fs.existsSync(out))inside(ROOT,'output/pixel-demo.mp4');
  run('ffmpeg',['-v','error','-nostdin','-y','-f','rawvideo','-pix_fmt','rgba','-s',width+'x'+height,'-r',String(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-map_metadata','-1',out],{input:Buffer.concat(raw)});console.log('output/pixel-demo.mp4');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
