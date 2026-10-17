'use strict';
// Normalize supplied expression poses from exact component bounds, preserving source PNGs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {ROOT,inside}=require('../src/project.cjs');
const {motions}=require('../src/pixel-motion.cjs');
const {sampleNearestRgba}=require('../src/pixel-sampling.cjs');
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
async function main(){
  const config=JSON.parse(fs.readFileSync(inside(ROOT,'assets/pixel/masters/pose-imports.json'),'utf8'));
  const sourcePath=inside(ROOT,'assets/pixel/sources.json'),sources=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
  const sampling=JSON.parse(fs.readFileSync(inside(ROOT,'assets/pixel/nearest-sampling.json'),'utf8'));
  assert.equal(sampling.schemaVersion,1);assert.equal(sampling.coordinateRule,'pixel-center-nearest');assert.equal(sampling.defaultTie,'upper');
  const entries={...config.characters,...config.variants},args=process.argv.slice(2),check=args.includes('--check'),ids=args.filter(id=>id!=='--check');
  for(const id of ids.length?ids:Object.keys(entries)){
    const entry=entries[id],variant=Object.hasOwn(config.variants||{},id),registry=variant?sources.variants:sources.characters;
    if(!entry||!Object.hasOwn(registry,id))throw Error('Unknown reviewed keypose character');
    if(entry.order.length!==10||entry.order.some(a=>!Object.hasOwn(motions,a))||new Set(entry.order).size!==10)throw Error('Ten distinct action IDs are required');
    assert.equal(sha256(fs.readFileSync(inside(ROOT,'assets/pixel/'+entry.sheet))),sampling.masters[entry.sheet],id+': sampling master SHA256');
    const image=await loadImage(inside(ROOT,'assets/pixel/'+entry.sheet)),atlas=createCanvas(image.width,image.height),ac=atlas.getContext('2d');ac.drawImage(image,0,0);
    const cells=[];
    for(const action of entry.order){
      const definition=entry.cells[action],rect=definition.padded,tight=definition.tight,bodyTight=definition.bodyTight||tight,[l,t,r,b]=rect;
      if(!(l>=0&&t>=0&&r<=image.width&&b<=image.height&&r>l&&b>t))throw Error('Invalid padded source bounds');
      const cell=createCanvas(r-l,b-t),c=cell.getContext('2d');c.drawImage(atlas,l,t,r-l,b-t,0,0,cell.width,cell.height);
      const data=c.getImageData(0,0,cell.width,cell.height),a=data.data,bbox=[tight[0]-l,tight[1]-t,tight[2]-l,tight[3]-t];
      let outsideTight=0;
      for(let y=0;y<cell.height;y++)for(let x=0;x<cell.width;x++){
        const k=(y*cell.width+x)*4;if(a[k+3]<(entry.alphaCutoff??128))a[k+3]=0;
        if(a[k+3]>=128&&(x<bbox[0]||y<bbox[1]||x>=bbox[2]||y>=bbox[3]))outsideTight++;
      }
      if(outsideTight)throw Error(id+'/'+action+': opaque pixels outside exact component bounds');
      c.putImageData(data,0,0);cells.push({action,cell,rect:[l,t,r-l,b-t],tight,bbox,bodyTight,bodyBox:[bodyTight[0]-l,bodyTight[1]-t,bodyTight[2]-l,bodyTight[3]-t],w:bodyTight[2]-bodyTight[0],h:bodyTight[3]-bodyTight[1],cropAdjustment:definition.cropAdjustment});
    }
    const neutral=cells.find(v=>v.action==='idle');
    const scale=Math.min(200/neutral.h,216/Math.max(...cells.map(v=>v.cell.width)),210/Math.max(...cells.map(v=>v.cell.height)));
    const keyposes={},poseProvenance={};
    for(const v of cells){
      const w=Math.round(v.cell.width*scale),h=Math.round(v.cell.height*scale);
      const tightWidth=v.w*scale,tightHeight=v.h*scale;
      const x=Math.round(128-tightWidth/2-v.bodyBox[0]*scale),y=Math.round(240-tightHeight-v.bodyBox[1]*scale);
      const record=sampling.poses[id+'/'+v.action];
      assert.ok(record,id+'/'+v.action+': sampling record');
      assert.equal(record.sheet,entry.sheet);assert.deepEqual(record.cell,v.rect);assert.deepEqual(record.targetRect,[x,y,w,h]);assert.equal(record.alphaCutoff,entry.alphaCutoff??128);
      const cv=createCanvas(256,256),c=cv.getContext('2d'),rgba=c.createImageData(w,h);
      rgba.data.set(sampleNearestRgba(v.cell.getContext('2d').getImageData(0,0,v.cell.width,v.cell.height).data,v.cell.width,v.cell.height,w,h,record.lowerTies));
      c.putImageData(rgba,x,y);
      assert.equal(sha256(Buffer.from(c.getImageData(0,0,256,256).data)),record.rgbaSha256,id+'/'+v.action+': exact normalized RGBA');
      const rel=id+'/'+entry.outputDirectory+'/'+v.action+'.png',dest=path.join(ROOT,'assets/pixel',rel);
      if(fs.existsSync(dest)){
        inside(ROOT,'assets/pixel/'+rel);assert.equal(sha256(fs.readFileSync(dest)),record.pngSha256,id+'/'+v.action+': existing PNG SHA256');
      }else if(check){
        throw Error(id+'/'+v.action+': reviewed normalized PNG is missing');
      }else{
        fs.mkdirSync(path.dirname(dest),{recursive:true});inside(ROOT,path.relative(ROOT,path.dirname(dest)));fs.writeFileSync(dest,cv.toBuffer('image/png'));
      }
      keyposes[v.action]=rel;poseProvenance[v.action]={sheet:entry.sheet,cell:v.rect,bbox:v.bbox,tightSourceRect:v.tight,bodyTightSourceRect:v.bodyTight,paddedSourceRect:[v.rect[0],v.rect[1],v.rect[0]+v.rect[2],v.rect[1]+v.rect[3]],targetRect:[x,y,w,h],commonScale:scale,scaleReference:'idle',pivot:[128,240],alphaCutoff:entry.alphaCutoff??128,sampling:'nearest-neighbor',masterUnmodified:true,sourceClippingPixels:0,...(v.cropAdjustment?{cropAdjustment:v.cropAdjustment}:{})};
    }
    const character=registry[id];delete character.neutralSource;
    character.base=keyposes.idle;character.keyposes=keyposes;character.poseProvenance=poseProvenance;
    character.source={kind:'imagegen-keypose-sheet',path:entry.sheet,pixelStyle:'generated pixel-look; partial alpha and many colors retained; renderer alpha cutoff 128',masterUnmodified:true};
    console.log(id+' / 10 supplied expression poses / scale '+scale.toFixed(4)+(check?' / exact RGBA checked':''));
  }
  if(!check)fs.writeFileSync(sourcePath,JSON.stringify(sources,null,2)+'\n');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
