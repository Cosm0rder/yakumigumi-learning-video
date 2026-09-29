'use strict';
require('../scripts/no-network.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {ROOT,inside,validate,readScript,build,stamp}=require('../src/project.cjs');
const {buildTimeline,createMovie,createCharacterAnimation}=require('../src/movie.cjs');
const {actions}=require('../src/character-actions.cjs');
test('教材と長編の台本が検証でき、タイムラインが単調増加する',()=>{
  for(const name of ['examples/lesson.json','examples/cosmic/script.json']){
    const script=readScript(name),tl=buildTimeline(script);let end=0;
    for(const s of tl.scenes){assert.ok(s.start>=end);for(const l of s.lines){assert.ok(l.start>=s.start);assert.ok(l.end>l.start);assert.ok(l.end<=s.end);}end=s.end;}
    assert.equal(tl.duration,end);
  }
});
test('パストラバーサル・絶対パス・不正ID・未知の話者を拒否する',()=>{
  assert.throws(()=>inside(ROOT,'../outside.json'));
  assert.throws(()=>inside(ROOT,path.resolve(ROOT,'package.json')));
  const s=readScript();s.scenes[0].lines[0].id='../secret';assert.throws(()=>validate(s));
  const t=readScript();t.scenes[0].lines[0].speaker='unknown';assert.throws(()=>validate(t));
  const u=readScript();u.scenes[0].id='constructor';assert.throws(()=>validate(u));
  const v=readScript();v.scenes[0].lines[0].id='toString';assert.throws(()=>validate(v));
});
test('学習場面の形式・負の棒・答えの時刻・動作名を検証する',()=>{
  for(const mutate of [s=>s.scenes[0].action='unknown',s=>s.scenes[1].visual.items[0].value=-1,s=>s.scenes[3].visual.revealAtLine=20,s=>s.scenes[0].visual.items=[]]){const s=readScript();mutate(s);assert.throws(()=>validate(s));}
});
test('本番は不足音声をエラーにし、生成APIへフォールバックしない',()=>{
  const s=readScript();for(const sc of s.scenes)for(const l of sc.lines)l.id='missing_'+l.id;
  assert.throws(()=>build(s),/音声が未配置/);
});
test('サンプル全場面と8動作が通信なしで描画でき、透過背景を持つ',async()=>{
  const tl=buildTimeline(readScript()),movie=await createMovie(tl);
  for(const s of tl.scenes){movie.frame((s.start+s.end)/2);assert.ok(movie.canvas.toBuffer('image/png').length>10000);}
  for(const action of actions){const mv=await createCharacterAnimation({action,size:128});mv.frame(.75);const d=mv.canvas.getContext('2d').getImageData(0,0,128,128).data;assert.equal(d[3],0);assert.ok(d.some((v,i)=>i%4===3&&v>0));}
});
test('字幕の時刻丸めとチャプター表記',()=>{assert.equal(stamp(60.001),'00:01:00,001');assert.equal(stamp(3600,true),'1:00:00');});

