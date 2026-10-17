'use strict';
require('../scripts/no-network.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createCanvas,loadImage}=require('@napi-rs/canvas');

const PIXEL_ROOT=path.resolve(__dirname,'../assets/pixel');
const MANIFEST=path.join(PIXEL_ROOT,'manifest.json');
const MOTIONS=['idle','blink','walk','cheer','surprise','worry','think','talk','point','bow'];
const pending=fs.existsSync(MANIFEST)?false:'Pixel manifest has not been generated yet';
const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);

function manifest(){return JSON.parse(fs.readFileSync(MANIFEST,'utf8'));}
function assetEntries(m){return [...Object.entries(m.characters),...Object.entries(m.variants||{})];}
function sha256(data){return crypto.createHash('sha256').update(data).digest('hex');}
function assetFile(relative){
  assert.equal(typeof relative,'string','asset path must be a relative string');
  assert.ok(relative.length>0,'asset path must not be empty');
  assert.ok(!path.isAbsolute(relative)&&!path.win32.isAbsolute(relative),'asset path must be relative');
  const target=path.resolve(PIXEL_ROOT,relative);
  assert.ok(target.startsWith(PIXEL_ROOT+path.sep),'asset path must remain inside assets/pixel');
  assert.ok(fs.statSync(target).isFile(),`missing asset: ${relative}`);
  return target;
}
function pngInfo(filename){
  const data=fs.readFileSync(filename);
  assert.ok(data.subarray(0,8).equals(PNG_SIGNATURE),`${filename}: invalid PNG signature`);
  const chunks=[];
  for(let offset=8;offset<data.length;){
    assert.ok(offset+12<=data.length,`${filename}: truncated PNG chunk`);
    const length=data.readUInt32BE(offset),end=offset+12+length;
    assert.ok(end<=data.length,`${filename}: truncated PNG payload`);
    chunks.push({type:data.toString('ascii',offset+4,offset+8),data:data.subarray(offset+8,offset+8+length)});
    offset=end;
  }
  assert.equal(chunks[0]?.type,'IHDR');
  assert.equal(chunks[0].data.length,13);
  assert.equal(chunks.at(-1)?.type,'IEND');
  const header=chunks[0].data;
  return {width:header.readUInt32BE(0),height:header.readUInt32BE(4),depth:header[8],colorType:header[9],chunks};
}
function assertRgbaPng(filename,width,height){
  const info=pngInfo(filename);
  assert.equal(info.width,width,`${filename}: width`);
  assert.equal(info.height,height,`${filename}: height`);
  assert.equal(info.depth,8,`${filename}: must use 8-bit channels`);
  assert.equal(info.colorType,6,`${filename}: must preserve RGBA`);
  return info;
}
function gifInfo(filename){
  const data=fs.readFileSync(filename);
  assert.match(data.toString('ascii',0,6),/^GIF8[79]a$/,`${filename}: invalid GIF signature`);
  assert.ok(data.length>=14,`${filename}: truncated GIF`);
  const width=data.readUInt16LE(6),height=data.readUInt16LE(8);
  let offset=13,frames=0,transparentFrames=0,transparent=false;
  if(data[10]&128)offset+=3*(1<<((data[10]&7)+1));
  function skipBlocks(){
    while(true){
      assert.ok(offset<data.length,`${filename}: truncated GIF sub-block`);
      const length=data[offset++];
      if(length===0)return;
      assert.ok(offset+length<=data.length,`${filename}: truncated GIF payload`);
      offset+=length;
    }
  }
  while(offset<data.length){
    const marker=data[offset++];
    if(marker===0x3b)break;
    if(marker===0x21){
      const label=data[offset++];
      if(label===0xf9){
        assert.equal(data[offset],4,`${filename}: invalid graphics control extension`);
        transparent=Boolean(data[offset+1]&1);
      }
      skipBlocks();
      continue;
    }
    assert.equal(marker,0x2c,`${filename}: invalid GIF block`);
    assert.ok(offset+9<=data.length,`${filename}: truncated GIF image descriptor`);
    const packed=data[offset+8];offset+=9;
    if(packed&128)offset+=3*(1<<((packed&7)+1));
    assert.ok(offset<data.length,`${filename}: missing GIF LZW code size`);
    offset++;
    skipBlocks();
    frames++;if(transparent)transparentFrames++;
    transparent=false;
  }
  assert.equal(data.at(-1),0x3b,`${filename}: missing GIF trailer`);
  return {width,height,frames,transparentFrames};
}
function pixels(canvas){
  return Buffer.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data);
}
function assertTransparentContent(canvas,label){
  const data=pixels(canvas);
  assert.equal(data[3],0,`${label}: top-left background must be transparent`);
  assert.ok(data.some((value,index)=>index%4===3&&value===0),`${label}: no transparent pixels`);
  assert.ok(data.some((value,index)=>index%4===3&&value>0),`${label}: empty character frame`);
}
function opaqueEdges(canvas){
  const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height,counts={};
  const edges={top:[0,0,width,1],bottom:[0,height-1,width,1],left:[0,0,1,height],right:[width-1,0,1,height]};
  for(const [edge,rect] of Object.entries(edges)){
    const data=ctx.getImageData(...rect).data;counts[edge]=0;
    for(let i=3;i<data.length;i+=4)if(data[i]>=128)counts[edge]++;
  }
  return counts;
}

test('pixel registry declares ten motions for every character and a 24-frame atlas contract',{skip:pending},()=>{
  const m=manifest();
  assert.equal(m.size,256);assert.equal(m.fps,12);assert.equal(m.frames,24);
  assert.equal(m.columns,6);assert.equal(m.rows,4);
  assert.deepEqual(Object.keys(m.motions).sort(),MOTIONS.slice().sort());
  assert.ok(m.characters&&typeof m.characters==='object'&&!Array.isArray(m.characters));
  assert.ok(Object.hasOwn(m.characters,'shoga'),'default shoga character must be registered');
  for(const [id,character] of assetEntries(m)){
    assert.match(id,/^[a-z][a-z0-9_-]*$/);
    assert.deepEqual(Object.keys(character.animations).sort(),MOTIONS.slice().sort(),`${id}: motion list`);
    for(const [action,animation] of Object.entries(character.animations)){
      assert.equal(animation.fps,12,`${id}/${action}: fps`);
      assert.equal(animation.duration,2,`${id}/${action}: duration`);
      assert.equal(animation.frameCount,24,`${id}/${action}: frame count`);
      assert.deepEqual(animation.pivot,[128,240],`${id}/${action}: pivot`);
      assert.equal(animation.frames.length,24,`${id}/${action}: individual frames`);
      assert.equal(new Set(animation.frames).size,24,`${id}/${action}: duplicated frame paths`);
    }
  }
});

test('pixel manifest includes exactly the fifteen confirmed characters and their compatibility aliases',{skip:pending},()=>{
  const roster=JSON.parse(fs.readFileSync(path.join(PIXEL_ROOT,'roster.json'),'utf8'));
  const m=manifest();
  assert.equal(roster.characterCount,15,'confirmed original character count');
  assert.equal(roster.characters.length,15,'confirmed roster entries');
  const ids=roster.characters.map(character=>character.id);
  assert.equal(new Set(ids).size,15,'confirmed roster IDs must be unique');
  assert.deepEqual(Object.keys(m.characters).sort(),ids.slice().sort(),'manifest must include the complete confirmed roster');
  assert.deepEqual(m.aliases,roster.aliases,'manifest aliases must match the confirmed roster');
  for(const character of roster.characters){
    assert.equal(m.characters[character.id].name,character.name,`${character.id}: confirmed name`);
  }
  for(const [alias,id] of Object.entries(roster.aliases)){
    assert.ok(!Object.hasOwn(m.characters,alias),`${alias}: alias must not duplicate a character`);
    assert.ok(Object.hasOwn(m.characters,id),`${alias}: alias target must be registered`);
  }
  assert.deepEqual(Object.keys(m.variants).sort(),['okra_slice','wasabi_tube'],'two appearance variants are counted separately');
  assert.equal(m.variants.wasabi_tube.parent,'wasabi');
  assert.equal(m.variants.okra_slice.parent,'okra');
  for(const id of Object.keys(m.variants))assert.ok(!ids.includes(id),`${id}: variant must not increase the character roster`);
});

test('all characters and variants use ten distinct supplied poses with exact source provenance and common scale',{skip:pending},async()=>{
  const m=manifest();
  for(const [id,entry] of assetEntries(m)){
    assert.equal(entry.source.kind,'imagegen-keypose-sheet',`${id}: supplied expression source`);
    assert.equal(entry.source.masterUnmodified,true,`${id}: source master preservation`);
    assert.deepEqual(Object.keys(entry.keyposes).sort(),MOTIONS.slice().sort(),`${id}: supplied pose list`);
    assert.deepEqual(Object.keys(entry.poseProvenance).sort(),MOTIONS.slice().sort(),`${id}: provenance list`);
    assert.equal(entry.base,entry.keyposes.idle,`${id}: neutral is the supplied idle pose`);
    const sourceImage=await loadImage(assetFile(entry.source.path));
    const sourceCanvas=createCanvas(sourceImage.width,sourceImage.height);
    sourceCanvas.getContext('2d').drawImage(sourceImage,0,0);
    const provenance=Object.values(entry.poseProvenance);
    const neutral=entry.poseProvenance.idle;
    const idleBody=neutral.bodyTightSourceRect||neutral.tightSourceRect;
    const scale=Math.min(200/(idleBody[3]-idleBody[1]),216/Math.max(...provenance.map(p=>p.cell[2])),210/Math.max(...provenance.map(p=>p.cell[3])));
    const fileHashes=[],pixelHashes=[];
    for(const action of MOTIONS){
      const label=`${id}/${action}`,p=entry.poseProvenance[action],animation=entry.animations[action];
      assert.equal(p.sheet,entry.source.path,`${label}: source sheet`);
      assert.equal(p.alphaCutoff,128,`${label}: shared alpha threshold`);
      assert.equal(p.sampling,'nearest-neighbor',`${label}: pixel sampling`);
      assert.equal(p.masterUnmodified,true,`${label}: unmodified master`);
      assert.equal(p.sourceClippingPixels,0,`${label}: source body clipping`);
      assert.equal(p.scaleReference,'idle',`${label}: common scale reference`);
      assert.deepEqual(p.pivot,[128,240],`${label}: source pose anchor`);
      assert.ok(Number.isFinite(p.commonScale)&&Math.abs(p.commonScale-scale)<1e-12,`${label}: idle body/full padded extent common scale`);
      assert.equal(p.commonScale,neutral.commonScale,`${label}: scale shared across poses`);
      assert.equal(animation.keypose,entry.keyposes[action],`${label}: animation pose`);
      assert.deepEqual(animation.poseSource,p,`${label}: animation provenance`);
      assert.match(animation.motionMethod,/supplied drawn expression poses/,`${label}: completed expression animation`);
      const [x,y,w,h]=p.cell;
      assert.ok([x,y,w,h].every(Number.isInteger)&&x>=0&&y>=0&&w>0&&h>0&&x+w<=sourceImage.width&&y+h<=sourceImage.height,`${label}: source crop bounds`);
      assert.deepEqual(p.paddedSourceRect,[x,y,x+w,y+h],`${label}: padded source rect`);
      assert.deepEqual(p.tightSourceRect,[x+p.bbox[0],y+p.bbox[1],x+p.bbox[2],y+p.bbox[3]],`${label}: tight source rect`);
      const body=p.bodyTightSourceRect||p.tightSourceRect;
      assert.ok(body[0]>=x&&body[1]>=y&&body[2]<=x+w&&body[3]<=y+h&&body[2]>body[0]&&body[3]>body[1],`${label}: body bounds inside padded crop`);
      const expectedRect=[Math.round(128-(body[2]-body[0])*scale/2-(body[0]-x)*scale),Math.round(240-(body[3]-y)*scale),Math.round(w*scale),Math.round(h*scale)];
      assert.deepEqual(p.targetRect,expectedRect,`${label}: body center and floor placement`);
      assert.ok(expectedRect[0]>=0&&expectedRect[1]>=0&&expectedRect[0]+expectedRect[2]<=256&&expectedRect[1]+expectedRect[3]<=256,`${label}: padded pose fits canvas`);
      const crop=createCanvas(w,h),context=crop.getContext('2d');
      context.drawImage(sourceCanvas,x,y,w,h,0,0,w,h);
      const data=context.getImageData(0,0,w,h);
      let edges=0;
      for(let row=0;row<h;row++)for(let col=0;col<w;col++){
        const offset=(row*w+col)*4;
        if(data.data[offset+3]<128)data.data[offset+3]=0;
        if(data.data[offset+3]>=128&&(col===0||row===0||col===w-1||row===h-1))edges++;
      }
      assert.equal(edges,0,`${label}: no opaque source pixels cut at the padded crop edge`);
      context.putImageData(data,0,0);
      const expected=createCanvas(256,256),expectedContext=expected.getContext('2d');expectedContext.imageSmoothingEnabled=false;
      expectedContext.drawImage(crop,0,0,w,h,...expectedRect);
      const filename=assetFile(entry.keyposes[action]);assertRgbaPng(filename,256,256);
      const actual=createCanvas(256,256);actual.getContext('2d').drawImage(await loadImage(filename),0,0);
      assertTransparentContent(actual,label);
      assert.ok(pixels(actual).equals(pixels(expected)),`${label}: pose must be sampled from the original pixels without chroma replacement or facial redraw`);
      fileHashes.push(sha256(fs.readFileSync(filename)));pixelHashes.push(sha256(pixels(actual)));
    }
    assert.equal(new Set(fileHashes).size,10,`${id}: ten different pose PNG SHA256 values`);
    assert.equal(new Set(pixelHashes).size,10,`${id}: ten different decoded poses`);
  }
});

test('every registered motion has RGBA atlas and frames plus 24-frame transparent GIF/APNG previews',{skip:pending},async()=>{
  const m=manifest();
  for(const [id,character] of assetEntries(m)){
    for(const [action,animation] of Object.entries(character.animations)){
      const label=`${id}/${action}`;
      const sheet=assetFile(animation.sheet);
      assertRgbaPng(sheet,1536,1024);
      for(const relative of animation.frames)assertRgbaPng(assetFile(relative),256,256);
      const gif=gifInfo(assetFile(animation.gif));
      assert.equal(gif.width,256,`${label}: GIF width`);assert.equal(gif.height,256,`${label}: GIF height`);
      assert.equal(gif.frames,24,`${label}: GIF frames`);
      assert.equal(gif.transparentFrames,24,`${label}: GIF transparency`);
      const apng=assertRgbaPng(assetFile(animation.apng),256,256);
      const animationControl=apng.chunks.find(chunk=>chunk.type==='acTL');
      assert.ok(animationControl,`${label}: APNG animation control missing`);
      assert.equal(animationControl.data.readUInt32BE(0),24,`${label}: APNG frames`);
      assert.equal(apng.chunks.filter(chunk=>chunk.type==='fcTL').length,24,`${label}: APNG frame controls`);
      const image=await loadImage(sheet),canvas=createCanvas(1536,1024);
      canvas.getContext('2d').drawImage(image,0,0);
      assertTransparentContent(canvas,label);
      for(const index of [0,9,23]){
        const frameImage=await loadImage(assetFile(animation.frames[index]));
        const frameCanvas=createCanvas(256,256);
        frameCanvas.getContext('2d').drawImage(frameImage,0,0);
        assertTransparentContent(frameCanvas,`${label}/frame ${index}`);
        const cell=canvas.getContext('2d').getImageData((index%6)*256,Math.floor(index/6)*256,256,256).data;
        assert.ok(pixels(frameCanvas).equals(Buffer.from(cell)),`${label}: frame ${index} differs from atlas cell`);
      }
    }
  }
});

test('all 4080 delivered frames keep the whole opaque character inside the canvas',{skip:pending},async()=>{
  const m=manifest(),canvas=createCanvas(256,256),ctx=canvas.getContext('2d'),findings=[];
  let checked=0;
  for(const [id,entry] of assetEntries(m))for(const [action,animation] of Object.entries(entry.animations)){
    for(let index=0;index<animation.frames.length;index++){
      ctx.clearRect(0,0,256,256);
      ctx.drawImage(await loadImage(assetFile(animation.frames[index])),0,0);
      checked++;
      const edges=opaqueEdges(canvas);
      if(Object.values(edges).some(Boolean))findings.push({id,action,frame:index,edges});
    }
  }
  assert.equal(checked,4080,'15 characters and 2 appearances, each with 10 motions and 24 frames');
  assert.deepEqual(findings,[],'alpha >= 128 pixels at the frame boundary indicate possible clipping: '+JSON.stringify(findings));
});

test('pixel animation API returns transparent deterministic looping frames for every character and motion',{skip:pending},async()=>{
  const {createPixelAnimation}=require('../src/pixel-animation.cjs');
  const m=manifest();
  for(const [character,entry] of Object.entries(m.characters)){
    for(const action of Object.keys(entry.animations)){
      const animation=await createPixelAnimation({character,action,size:256});
      assert.equal(animation.canvas.width,256);assert.equal(animation.canvas.height,256);
      assert.ok(animation.metadata&&typeof animation.metadata==='object',`${character}/${action}: metadata`);
      assert.equal(animation.frame(0),animation.canvas);
      assertTransparentContent(animation.canvas,`${character}/${action}`);
      const first=pixels(animation.canvas);
      const sourceFrame=createCanvas(256,256);
      sourceFrame.getContext('2d').drawImage(await loadImage(assetFile(entry.animations[action].frames[0])),0,0);
      assert.ok(first.equals(pixels(sourceFrame)),`${character}/${action}: API differs from first asset frame`);
      assert.equal(animation.frame(2),animation.canvas);
      assert.ok(pixels(animation.canvas).equals(first),`${character}/${action}: loop at two seconds`);
      animation.frame(.75);const middle=pixels(animation.canvas);
      sourceFrame.getContext('2d').clearRect(0,0,256,256);
      sourceFrame.getContext('2d').drawImage(await loadImage(assetFile(entry.animations[action].frames[9])),0,0);
      assert.ok(middle.equals(pixels(sourceFrame)),`${character}/${action}: API differs from asset frame 9`);
      animation.frame(2.75);
      assert.ok(pixels(animation.canvas).equals(middle),`${character}/${action}: positive time wrapping`);
      animation.frame(-1.25);
      assert.ok(pixels(animation.canvas).equals(middle),`${character}/${action}: negative time wrapping`);
      animation.frame(0);
      assert.ok(pixels(animation.canvas).equals(first),`${character}/${action}: deterministic replay`);
      if(action==='blink'){
        sourceFrame.getContext('2d').clearRect(0,0,256,256);
        sourceFrame.getContext('2d').drawImage(await loadImage(assetFile(entry.keyposes.blink)),0,0);
        animation.frame(11/12);
        assert.ok(pixels(animation.canvas).equals(pixels(sourceFrame)),`${character}: blink uses the actual supplied closed-eye pose`);
      }
    }
  }
  const defaultAnimation=await createPixelAnimation();
  assert.equal(defaultAnimation.canvas.width,256);assert.equal(defaultAnimation.canvas.height,256);
  const scaled=await createPixelAnimation({size:128});
  assert.equal(scaled.canvas.width,128);assert.equal(scaled.canvas.height,128);
  scaled.frame(0);assertTransparentContent(scaled.canvas,'scaled shoga/idle');
  for(const [alias,character] of Object.entries(m.aliases||{})){
    if(!Object.hasOwn(m.characters,character))continue; // The roster test reports any pending alias target.
    const aliased=await createPixelAnimation({character:alias});
    const canonical=await createPixelAnimation({character});
    assert.equal(aliased.metadata.character,character,`${alias}: canonical character metadata`);
    aliased.frame(.75);canonical.frame(.75);
    assert.ok(pixels(aliased.canvas).equals(pixels(canonical.canvas)),`${alias}: canonical animation`);
  }
});

test('variant API plays the two existing-character appearances and rejects mismatched parents',{skip:pending},async()=>{
  const {createPixelAnimation}=require('../src/pixel-animation.cjs');
  const m=manifest();
  assert.deepEqual(Object.keys(m.variants).sort(),['okra_slice','wasabi_tube']);
  for(const [variant,entry] of Object.entries(m.variants)){
    for(const action of MOTIONS){
      const animation=await createPixelAnimation({character:entry.parent,variant,action});
      assert.equal(animation.metadata.character,entry.parent,`${variant}: existing parent character`);
      assert.equal(animation.metadata.variant,variant,`${variant}: appearance metadata`);
      assert.equal(animation.metadata.keypose,entry.keyposes[action],`${variant}/${action}: pose metadata`);
      animation.frame(0);assertTransparentContent(animation.canvas,`${variant}/${action}`);
      const first=pixels(animation.canvas);
      const source=createCanvas(256,256);
      source.getContext('2d').drawImage(await loadImage(assetFile(entry.animations[action].frames[0])),0,0);
      assert.ok(first.equals(pixels(source)),`${variant}/${action}: API matches source frame`);
      animation.frame(2);
      assert.ok(pixels(animation.canvas).equals(first),`${variant}/${action}: looping`);
      animation.frame(.75);const middle=pixels(animation.canvas);
      animation.frame(-1.25);
      assert.ok(pixels(animation.canvas).equals(middle),`${variant}/${action}: negative time wrapping`);
      if(action==='blink'){
        source.getContext('2d').clearRect(0,0,256,256);
        source.getContext('2d').drawImage(await loadImage(assetFile(entry.keyposes.blink)),0,0);
        animation.frame(11/12);
        assert.ok(pixels(animation.canvas).equals(pixels(source)),`${variant}: supplied blink pose`);
      }
    }
    await assert.rejects(async()=>createPixelAnimation({character:'shoga',variant}),`${variant}: mismatched character parent`);
  }
  for(const variant of ['unknown','constructor','toString','__proto__',42,['wasabi_tube'],{toString:()=> 'wasabi_tube'}]){
    await assert.rejects(async()=>createPixelAnimation({character:'wasabi',variant}));
  }
});

test('frameIndex wraps positive and negative times and rejects invalid times',{skip:pending},()=>{
  const {frameIndex}=require('../src/pixel-animation.cjs');
  for(const [time,expected] of [[0,0],[.125,1],[1,12],[1.999,23],[2,0],[2.125,1],[-1,12],[-2,0],[-1.875,1]]){
    assert.equal(frameIndex(time),expected,`time ${time}`);
  }
  for(let index=0;index<24;index++){
    for(const cycle of [-2,0,2]){
      assert.equal(frameIndex(index/12+cycle),index,`frame ${index} boundary in cycle ${cycle}`);
    }
    assert.equal(frameIndex((index+1)/12-1e-6),index,`frame ${index}: time just before next boundary`);
  }
  assert.equal(frameIndex(.75,{fps:4,frames:8}),3);
  assert.equal(frameIndex(2,{fps:4,frames:8}),0);
  assert.equal(frameIndex(Number.MAX_VALUE),0,'large finite times must wrap without overflowing');
  assert.equal(frameIndex(-Number.MAX_VALUE),0,'large negative finite times must wrap without overflowing');
  for(const time of [Number.MAX_VALUE,-Number.MAX_VALUE,1e30,-1e30]){
    const index=frameIndex(time);
    assert.ok(Number.isInteger(index)&&index>=0&&index<24,`time ${time}: valid frame index`);
  }
  for(const time of [NaN,Infinity,-Infinity,'0',null,undefined])assert.throws(()=>frameIndex(time));
});

test('pixel animation API rejects invalid characters, motions, sizes and frame times',{skip:pending},async()=>{
  const {createPixelAnimation}=require('../src/pixel-animation.cjs');
  for(const character of ['unknown','../shoga','constructor','toString','__proto__','',null,42,['shoga'],{toString:()=> 'shoga'}]){
    await assert.rejects(async()=>createPixelAnimation({character}));
  }
  for(const action of ['unknown','../idle','constructor','toString','__proto__','',null,42,['idle'],{toString:()=> 'idle'}]){
    await assert.rejects(async()=>createPixelAnimation({action}));
  }
  for(const size of [0,-1,NaN,Infinity,'256',null,1.5]){
    await assert.rejects(async()=>createPixelAnimation({size}));
  }
  const animation=await createPixelAnimation();
  for(const time of [NaN,Infinity,-Infinity,'0',null,undefined])assert.throws(()=>animation.frame(time));
});
