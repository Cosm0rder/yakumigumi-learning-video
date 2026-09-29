'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const {createCharacterAnimation}=require('../src/movie.cjs');
const {actions,labels}=require('../src/character-actions.cjs');
const {ROOT,run,inside}=require('../src/project.cjs');
async function main(){
  const dir=path.join(ROOT,'output','characters');fs.mkdirSync(dir,{recursive:true});inside(ROOT,'output');inside(ROOT,'output/characters');
  const size=256,fps=12,frames=24,cols=6,rows=4;
  const manifest={size,fps,frames,columns:cols,rows,duration:2,loop:true,alpha:true,actions:{}};
  for(const action of actions){
    const mv=await createCharacterAnimation({action,size}),sheet=createCanvas(cols*size,rows*size),ctx=sheet.getContext('2d'),raw=[];
    for(let i=0;i<frames;i++){mv.frame(i/fps);ctx.drawImage(mv.canvas,(i%cols)*size,Math.floor(i/cols)*size);const d=mv.canvas.getContext('2d').getImageData(0,0,size,size).data;raw.push(Buffer.from(d));}
    fs.writeFileSync(path.join(dir,action+'.png'),sheet.toBuffer('image/png'));
    run('ffmpeg',['-v','error','-nostdin','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${size}x${size}`,'-r',String(fps),'-i','pipe:0','-filter_complex','[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=bayer:alpha_threshold=128','-loop','0','-map_metadata','-1',path.join(dir,action+'.gif')],{input:Buffer.concat(raw)});
    manifest.actions[action]={label:labels[action],sheet:action+'.png',preview:action+'.gif'};
    console.log('character:',action);
  }
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><meta charset="utf-8"><title>しょうがちゃん モーション集</title><style>body{background:#172439;color:#fff;font:18px system-ui}main{display:flex;flex-wrap:wrap}figure{margin:16px;text-align:center}img{background:repeating-conic-gradient(#31445d 0 25%,#263a50 0 50%) 0/32px 32px;width:256px}</style><h1>しょうがちゃん モーション集</h1><p>2秒ループ・12fps・透過PNGスプライトシートとGIF</p><main>'+actions.map(a=>`<figure><img src="${a}.gif"><figcaption>${labels[a]} / ${a}</figcaption></figure>`).join('')+'</main>');
  console.log('output/characters/index.html をブラウザーで開けます。');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

