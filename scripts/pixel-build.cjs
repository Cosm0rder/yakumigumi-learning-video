'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {ROOT,inside,run}=require('../src/project.cjs');
const {motions,size,fps,frames,columns,rows,renderMotion}=require('../src/pixel-motion.cjs');
const target=path.join(ROOT,'assets','pixel');
function write(relative,data){const rel='assets/pixel/'+relative;const dest=path.join(ROOT,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});inside(ROOT,path.relative(ROOT,path.dirname(dest)));if(fs.existsSync(dest))inside(ROOT,rel);fs.writeFileSync(dest,data);}
async function main(){
  const args=process.argv.slice(2),allowNeutral=args.includes('--allow-neutral'),selected=args.filter(s=>s!=='--allow-neutral');if(selected.some(s=>!/^[a-z][a-z0-9_-]*$/.test(s)))throw Error('Use character IDs only');
  const source=JSON.parse(fs.readFileSync(inside(ROOT,'assets/pixel/sources.json'),'utf8'));
  const entries={...source.characters,...source.variants};
  const ids=selected.length?selected:Object.keys(entries);for(const id of ids)if(!Object.hasOwn(entries,id))throw Error('Unknown source character or variant: '+id);
  const pending=ids.filter(id=>Object.keys(motions).some(action=>!entries[id].keyposes?.[action]));
  if(!allowNeutral&&pending.length)throw Error('Ten supplied expression poses are required for: '+pending.join(', ')+'. Neutral-only trials use --allow-neutral');
  let characters={},variants={};const manifestPath=path.join(target,'manifest.json');if(selected.length&&fs.existsSync(manifestPath)){const previous=JSON.parse(fs.readFileSync(manifestPath,'utf8'));characters=previous.characters;variants=previous.variants||{};}
  const manifest={schemaVersion:1,size,fps,frames,columns,rows,duration:frames/fps,loop:true,alpha:true,pivot:[128,240],aliases:source.aliases||{},motions:Object.fromEntries(Object.entries(motions).map(([id,label])=>[id,{label}])),characters,variants};
  for(const id of ids){const entry=entries[id];const basePath=inside(ROOT,'assets/pixel/'+entry.base);const base=await loadImage(basePath);
    if(base.width!==size||base.height!==size)throw Error(id+': supplied base must be 256 x 256');
    let keyposes=null;if(entry.keyposes){keyposes={};for(const action of Object.keys(motions)){keyposes[action]=await loadImage(inside(ROOT,'assets/pixel/'+entry.keyposes[action]));if(keyposes[action].width!==size||keyposes[action].height!==size)throw Error('Keypose must be 256 x 256');}}
    const character={name:entry.name,...(entry.parent?{parent:entry.parent}:{}),base:entry.base,anatomy:entry.anatomy,source:entry.source,rig:entry.rig,keyposes:entry.keyposes,poseProvenance:entry.poseProvenance,animations:{}};
    for(const action of Object.keys(motions)){const sheet=createCanvas(columns*size,rows*size),ctx=sheet.getContext('2d');const raw=[],frameFiles=[];ctx.imageSmoothingEnabled=false;
      for(let i=0;i<frames;i++){const cv=renderMotion(base,entry.rig||{},action,i,keyposes);ctx.drawImage(cv,(i%columns)*size,Math.floor(i/columns)*size);const name=id+'/frames/'+action+'/'+String(i).padStart(3,'0')+'.png';write(name,cv.toBuffer('image/png'));frameFiles.push(name);raw.push(Buffer.from(cv.getContext('2d').getImageData(0,0,size,size).data));}
      const name=id+'/'+action+'.png',gif=id+'/previews/'+action+'.gif',apng=id+'/previews/'+action+'.apng';write(name,sheet.toBuffer('image/png'));fs.mkdirSync(path.join(target,id,'previews'),{recursive:true});inside(ROOT,'assets/pixel/'+id+'/previews');
      const input=['-v','error','-nostdin','-y','-f','rawvideo','-pix_fmt','rgba','-s',size+'x'+size,'-r',String(fps),'-i','pipe:0'];
      run('ffmpeg',[...input,'-filter_complex','[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=none:alpha_threshold=128','-loop','0','-map_metadata','-1',path.join(target,gif)],{input:Buffer.concat(raw)});
      run('ffmpeg',[...input,'-c:v','apng','-plays','0','-f','apng','-map_metadata','-1',path.join(target,apng)],{input:Buffer.concat(raw)});
      character.animations[action]={label:motions[action],sheet:name,gif,apng,frames:frameFiles,duration:frames/fps,fps,frameCount:frames,pivot:entry.rig?.anchor||[128,240],keypose:entry.keyposes?.[action],poseSource:entry.poseProvenance?.[action],motionMethod:keyposes?'supplied drawn expression poses plus local timeline motion; no facial overlays':'neutral-only trial rig; expression keyposes pending'};
      console.log(id+'/'+action);
    }
    (Object.hasOwn(source.variants||{},id)?variants:characters)[id]=character;
  }
  write('manifest.json',JSON.stringify(manifest,null,2)+'\n');write('manifest.js','globalThis.YAKUMIGUMI_PIXEL_MANIFEST = '+JSON.stringify(manifest,null,2)+';\n');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
