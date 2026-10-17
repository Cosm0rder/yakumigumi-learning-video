'use strict';
// Stream all characters through ten motions into a local review MP4.
// Uses one motion's sheets at a time and streams frames instead of buffering a movie.
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const {createPixelAnimation}=require('../src/pixel-animation.cjs');
const {ROOT,inside}=require('../src/project.cjs');
async function main(){
  const manifest=JSON.parse(fs.readFileSync(inside(ROOT,'assets/pixel/manifest.json'),'utf8'));
  const ids=Object.keys(manifest.characters),actions=Object.keys(manifest.motions),width=1280,height=720,fps=12;
  GlobalFonts.registerFromPath(inside(ROOT,'assets/fonts/NotoSansJP.ttf'),'PixelReview');
  fs.mkdirSync(path.join(ROOT,'output'),{recursive:true});inside(ROOT,'output');const out=path.join(ROOT,'output','pixel-cast-demo.mp4');if(fs.existsSync(out))inside(ROOT,'output/pixel-cast-demo.mp4');
  const encoder=spawn('ffmpeg',['-v','error','-nostdin','-y','-f','rawvideo','-pix_fmt','rgba','-s',width+'x'+height,'-r',String(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-map_metadata','-1',out],{stdio:['pipe','ignore','pipe'],windowsHide:true});
  let stderr='',encoderError=null;encoder.stderr.on('data',data=>{stderr=(stderr+data).slice(-4096);});encoder.on('error',e=>{encoderError=e;});encoder.stdin.on('error',e=>{encoderError=e;});
  const completion=new Promise((resolve,reject)=>{encoder.once('error',reject);encoder.once('close',code=>code===0?resolve():reject(Error(stderr||'FFmpeg failed')));});completion.catch(e=>{encoderError=e;});
  const cv=createCanvas(width,height),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
  try{for(const action of actions){let animations=await Promise.all(ids.map(character=>createPixelAnimation({character,action,size:192})));
    for(let frame=0;frame<24;frame++){if(encoderError)throw encoderError;ctx.fillStyle='#17283b';ctx.fillRect(0,0,width,height);ctx.fillStyle='#fff3cf';ctx.textAlign='center';ctx.font='bold 26px PixelReview';ctx.fillText('やくみ組 — '+manifest.motions[action].label,width/2,37);
      animations.forEach((anim,k)=>{const x=(k%5)*256+32,y=54+Math.floor(k/5)*216;anim.frame(frame/fps);ctx.drawImage(anim.canvas,x,y,192,192);ctx.fillStyle='#f9edca';ctx.font='16px PixelReview';ctx.fillText(manifest.characters[ids[k]].name+' / '+ids[k],x+96,y+204);});
      const data=Buffer.from(ctx.getImageData(0,0,width,height).data);if(!encoder.stdin.write(data))await once(encoder.stdin,'drain');}
    animations=null;console.log(action+' / '+ids.length+' characters');}
    encoder.stdin.end();await completion;console.log('output/pixel-cast-demo.mp4');
  }catch(e){encoder.stdin.destroy();encoder.kill();throw e;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
