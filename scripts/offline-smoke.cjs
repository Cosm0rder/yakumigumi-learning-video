'use strict';
const path=require('node:path');
const {ROOT,run}=require('../src/project.cjs');
const preload=path.join(__dirname,'no-network.cjs');
// Tiny local render, no TTS. FFmpeg inputs are files/pipes, with protocol whitelist.
for(const args of [
  ['scripts/cli.cjs','doctor'],
  ['scripts/cli.cjs','stills','--draft'],
  ['scripts/cli.cjs','render','--draft','--seconds','2','--width','640','--fps','12','--out','offline-smoke.mp4']
])process.stdout.write(run(process.execPath,['--require',preload,...args],{cwd:ROOT}));
console.log('外向きのNode通信をブロックした状態で描画・MP4作成が完了しました。');

