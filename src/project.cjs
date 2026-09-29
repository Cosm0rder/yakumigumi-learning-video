'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const SPEAKERS=new Set(['shoga','daikon','garlic','chili','negi']);
const ID=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const validId=id=>typeof id==='string'&&ID.test(id)&&!Object.hasOwn(Object.prototype,id);
function inside(root,relative,mustExist=true){
  if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('\0'))throw Error('相対パスを指定してください。');
  const base=fs.realpathSync(root), candidate=path.resolve(base,relative);
  if(candidate===base||!candidate.startsWith(base+path.sep))throw Error('作業フォルダーの外は参照できません。');
  if(mustExist){const real=fs.realpathSync(candidate);if(!real.startsWith(base+path.sep))throw Error('外部を指すシンボリックリンクは使えません。');return real;}
  return candidate;
}
function run(command,args,options={}){
  const r=spawnSync(command,args,{windowsHide:true,shell:false,maxBuffer:128*1024*1024,...options});
  if(r.error)throw Error(`${command} を実行できません。PATH と npm run doctor を確認してください。`);
  if(r.status!==0)throw Error(`${command} が失敗しました: ${String(r.stderr||'').slice(-1600)}`);
  return r.stdout;
}
function validate(script){
  if(!script||typeof script.title!=='string'||!script.title.trim())throw Error('title が必要です。');
  if(!Array.isArray(script.scenes)||!script.scenes.length)throw Error('scenes が必要です。');
  const ids=new Set(),sceneIds=new Set();
  for(const s of script.scenes){
    if(!validId(s.id)||sceneIds.has(s.id))throw Error('scene id は予約語を避け、重複しない英数字・_・-で指定してください。');
    sceneIds.add(s.id);
    if(typeof s.title!=='string'||typeof s.kind!=='string')throw Error('scene title と kind が必要です。');
    if(!Array.isArray(s.lines)||!s.lines.length)throw Error(`${s.id}: lines が必要です。`);
    for(const l of s.lines){
      if(!validId(l.id)||ids.has(l.id))throw Error('台詞 id は予約語を避け、重複しない英数字・_・-で指定してください。');
      ids.add(l.id);
      if(!SPEAKERS.has(l.speaker))throw Error(`${l.id}: speaker が不明です。`);
      if(typeof l.text!=='string'||!l.text.trim()||l.text.length>1200)throw Error(`${l.id}: text は1〜1200文字です。`);
    }
    if(s.kind==='lesson'){
      if(s.action&&!require('./character-actions.cjs').actions.includes(s.action))throw Error('不明な character action です。');
      const v=s.visual;
      if(!v||!['cards','steps','bars','question'].includes(v.layout))throw Error(`${s.id}: visual.layout が不明です。`);
      if(v.layout!=='question'){
        if(!Array.isArray(v.items)||v.items.length<1||v.items.length>3)throw Error('items は1〜3個にしてください。');
        if(v.items.some(x=>!x||typeof x.label!=='string'||!['string','number'].includes(typeof x.value)))throw Error('item に label/value が必要です。');
        if(v.layout==='bars'&&v.items.some(x=>typeof x.value!=='number'||!Number.isFinite(x.value)||x.value<0))throw Error('bars の value は0以上の数値です。');
      }else if(typeof v.answer!=='string'||!Number.isInteger(v.revealAtLine)||v.revealAtLine<0||v.revealAtLine>=s.lines.length){throw Error('question には answer と有効な revealAtLine が必要です。');}
    }
  }
  return script;
}
function readScript(relative='examples/lesson.json'){
  return validate(JSON.parse(fs.readFileSync(inside(ROOT,relative),'utf8').replace(/^\uFEFF/,'')));
}
function stamp(sec,chapter=false){
  const ms=Math.round(sec*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;
  if(chapter)return(h?String(h)+':':'')+String(h?m:Math.floor(sec/60)).padStart(2,'0')+':'+String(s).padStart(2,'0');
  return[h,m,s].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');
}
function findAudio(id){
  for(const ext of ['wav','flac','mp3','m4a','ogg']){
    const relative=`audio/${id}.${ext}`;
    if(fs.existsSync(path.join(ROOT,relative)))return inside(path.join(ROOT,'audio'),`${id}.${ext}`);
  }
  return null;
}
function decode(file){
  return run('ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file,pipe','-i',file,'-vn','-f','s16le','-ar','24000','-ac','1','pipe:1']);
}
function build(script,{draft=false}={}){
  const dir=path.join(ROOT,'output');fs.mkdirSync(dir,{recursive:true});
  // Validate output real path as well, so output cannot redirect to a private folder.
  inside(ROOT,'output');
  const missing=script.scenes.flatMap(s=>s.lines).filter(l=>!findAudio(l.id));
  if(missing.length&&!draft)throw Error(`音声が未配置です: ${missing.map(l=>l.id).join(', ')}。無音確認は --draft を指定。`);
  const temp=path.join(dir,'narration.pcm'), fd=fs.openSync(temp,'w');
  let samples=0; const durations={}, cues=[], measured={};
  try{
    for(const s of script.scenes)for(const l of s.lines){
      const f=findAudio(l.id), pcm=f?decode(f):null;
      const duration=pcm?pcm.length/48000:Math.max(2,l.text.length/7+.4);
      if(!Number.isFinite(duration)||duration<=0||duration>180)throw Error(`${l.id}: 音声の長さが不正です（上限180秒）。`);
      measured[l.id]={file:f,duration};durations[l.id]=duration;
    }
    const movie=require('./movie.cjs');
    const tl={...movie.buildTimeline(script,durations),title:script.title,draft,missingAudio:missing.map(l=>l.id)};
    const silenceTo=t=>{const n=Math.max(0,Math.round(t*24000)-samples);if(n){fs.writeSync(fd,Buffer.alloc(n*2));samples+=n;}};
    for(const s of tl.scenes){
      for(const l of s.lines){
        silenceTo(l.start);const info=measured[l.id];
        const pcm=info.file?decode(info.file):Buffer.alloc(Math.round(info.duration*24000)*2);
        fs.writeSync(fd,pcm);samples+=pcm.length/2;
        // Subtitle grouping is shared with the renderer. Intra-utterance timings are estimated.
        const parts=movie.segmentize(l.text), length=parts.reduce((n,p)=>n+p.join('').length,0);let offset=0;
        for(const p of parts){const a=l.start+(l.end-l.start)*offset/length;offset+=p.join('').length;const b=l.start+(l.end-l.start)*offset/length;cues.push([a,b,p.join('\n')]);}
      }
      silenceTo(s.end);
    }
    fs.closeSync(fd);
    run('ffmpeg',['-v','error','-nostdin','-y','-f','s16le','-ar','24000','-ac','1','-i',temp,'-map_metadata','-1','-ar','48000','-ac','2','-c:a','pcm_s16le',path.join(dir,'narration.wav')]);
    fs.unlinkSync(temp);
    fs.writeFileSync(path.join(dir,'timeline.json'),JSON.stringify(tl,null,2)+'\n');
    fs.writeFileSync(path.join(dir,'subtitles.srt'),cues.map(([a,b,t],i)=>`${i+1}\n${stamp(a)} --> ${stamp(b)}\n${t}`).join('\n\n')+'\n');
    fs.writeFileSync(path.join(dir,'chapters.txt'),tl.scenes.map(s=>`${stamp(s.start,true)} ${s.title}`).join('\n')+'\n');
    return tl;
  }catch(e){try{fs.closeSync(fd);}catch{}throw e;}
}
module.exports={ROOT,inside,run,validate,readScript,stamp,findAudio,build};

