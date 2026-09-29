'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {ROOT,run,readScript,inside,build}=require('../src/project.cjs');
const {createCanvas}=require('@napi-rs/canvas');
const {createMovie}=require('../src/movie.cjs');
const args=process.argv.slice(2),cmd=args.shift()||'help';
function opt(name,def){const i=args.indexOf('--'+name);return i<0?def:args[i+1];}
function number(name,def,min,max){const n=Number(opt(name,def));if(!Number.isFinite(n)||n<min||n>max)throw Error(`--${name} は ${min}〜${max} です。`);return n;}
async function render(tl){
  const fps=number('fps',30,1,60),width=number('width',1920,320,1920),height=width*9/16;
  if(!Number.isInteger(width/2)||!Number.isInteger(height/2))throw Error('幅は1920、1280、960、640など、16:9で縦横が偶数になる値を指定。');
  const start=number('from',0,0,Math.max(0,tl.duration-.01));
  const seconds=Math.min(number('seconds',tl.duration-start,.01,86400),tl.duration-start),frames=Math.ceil(seconds*fps);
  const movie=await createMovie(tl),canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  const out=path.join(ROOT,'output',opt('out',tl.draft?'preview.mp4':'video.mp4'));
  const fileName=path.basename(out);if(!/^[a-zA-Z0-9_-]+\.mp4$/.test(fileName)||out!==path.join(ROOT,'output',fileName))throw Error('--out はファイル名だけを指定。');
  const bgmOpt=opt('bgm',null),bgm=bgmOpt?inside(path.join(ROOT,'audio'),bgmOpt):null;
  const ffargs=['-hide_banner','-loglevel','error','-nostdin','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${width}x${height}`,'-r',String(fps),'-i','pipe:0','-ss',String(start),'-protocol_whitelist','file,pipe','-i',path.join(ROOT,'output','narration.wav')];
  if(bgm){
    ffargs.push('-stream_loop','-1','-ss',String(start),'-protocol_whitelist','file,pipe','-i',bgm,'-filter_complex','[1:a]asplit=2[voice][key];[2:a]volume=0.16[music];[music][key]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=600[duck];[voice][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95[mix]','-map','0:v','-map','[mix]');
  }else ffargs.push('-map','0:v','-map','1:a');
  ffargs.push('-map_metadata','-1','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-t',String(seconds),'-movflags','+faststart',out);
  const ff=spawn('ffmpeg',ffargs,{windowsHide:true,shell:false,stdio:['pipe','ignore','pipe']});
  let stderr='',pipeError;ff.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});
  ff.stdin.on('error',e=>{pipeError=e;});
  const closed=new Promise(resolve=>{ff.on('error',e=>resolve({error:e}));ff.on('close',code=>resolve({code}));});
  for(let i=0;i<frames;i++){
    if(pipeError)break;
    movie.frame(start+i/fps);ctx.drawImage(movie.canvas,0,0,width,height);
    if(tl.draft){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,height-23,width,23);ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText('DRAFT / missing audio may be silent',12,height-7);}
    const raw=ctx.getImageData(0,0,width,height).data;
    if(!ff.stdin.write(Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength))){
      await new Promise(resolve=>{const done=()=>{ff.stdin.off('drain',done);ff.stdin.off('error',done);ff.stdin.off('close',done);resolve();};ff.stdin.once('drain',done);ff.stdin.once('error',done);ff.stdin.once('close',done);});
    }
    if(i%(Math.ceil(fps)*5)===0)console.log(`render ${Math.floor(i/frames*100)}%`);
  }
  ff.stdin.end();const result=await closed;
  if(result.error||result.code!==0||pipeError)throw Error(`動画出力が失敗しました: ${stderr||String(result.error||pipeError)}`);
  const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',out]));
  if(Math.abs(Number(probe.format.duration)-seconds)>.2||probe.streams.filter(x=>x.codec_type==='video').length!==1||!probe.streams.some(x=>x.codec_type==='audio'))throw Error('動画の検証に失敗しました。');
  fs.writeFileSync(path.join(ROOT,'output','render-report.json'),JSON.stringify({file:fileName,requestedSeconds:seconds,frames,probe,draft:tl.draft,missingAudio:tl.missingAudio},null,2)+'\n');
  console.log(`完成: output/${fileName} (${Number(probe.format.duration).toFixed(1)}秒)`);
}
async function main(){
  if(cmd==='doctor'){
    console.log('Node',process.versions.node);
    for(const c of ['ffmpeg','ffprobe'])console.log(String(run(c,['-version'])).split('\n')[0]);
    for(const f of ['assets/characters-key.png','assets/v2/motion.png','assets/fonts/NotoSansJP.ttf','assets/v2/DelaGothicOne-Regular.ttf'])inside(ROOT,f);
    console.log('素材・フォント・Canvas OK。APIキー不要。');return;
  }
  if(cmd==='help'){console.log('doctor | narration | stills [--draft] | render [--draft] [--script examples/lesson.json] [--width 1920] [--fps 30] [--from 0] [--seconds 10] [--bgm music.wav] [--out video.mp4]');return;}
  if(!['narration','stills','render'].includes(cmd))throw Error('不明なコマンド');
  const script=readScript(opt('script','examples/lesson.json'));fs.mkdirSync(path.join(ROOT,'output'),{recursive:true});inside(ROOT,'output');
  if(cmd==='narration'){
    const lines=script.scenes.flatMap(s=>s.lines);
    fs.writeFileSync(path.join(ROOT,'output','narration.txt'),lines.map(l=>`[${l.id}] ${l.speaker}\n${l.say||l.text}\n保存名: audio/${l.id}.wav`).join('\n\n')+'\n');
    console.log('output/narration.txt に音声作成用の台詞を出力しました。通信は行っていません。');return;
  }
  const tl=build(script,{draft:args.includes('--draft')});
  if(cmd==='render'){await render(tl);return;}
  const movie=await createMovie(tl),cols=2,sw=640,sh=360,rows=Math.ceil(tl.scenes.length/cols),sheet=createCanvas(cols*sw,rows*(sh+44)),s=sheet.getContext('2d');
  s.fillStyle='#111b2b';s.fillRect(0,0,sheet.width,sheet.height);
  for(let i=0;i<tl.scenes.length;i++){
    const sc=tl.scenes[i];movie.frame((sc.start+sc.end)/2);
    const x=(i%cols)*sw,y=Math.floor(i/cols)*(sh+44);s.drawImage(movie.canvas,x,y,sw,sh);s.fillStyle='#fff';s.font='21px sans-serif';s.fillText(`${i+1} / ${sc.id}`,x+10,y+sh+28);
  }
  fs.writeFileSync(path.join(ROOT,'output','storyboard.png'),sheet.toBuffer('image/png'));
  movie.frame(tl.scenes[0].start+Math.min(3,(tl.scenes[0].end-tl.scenes[0].start)*.5));
  const thumb=createCanvas(1280,720);thumb.getContext('2d').drawImage(movie.canvas,0,0,1280,720);fs.writeFileSync(path.join(ROOT,'output','thumbnail.png'),thumb.toBuffer('image/png'));
  console.log('output/storyboard.png と output/thumbnail.png を作成しました。');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

