'use strict';
// Loopback-only, fixed-file preview. No account integration or outbound requests.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {ROOT,inside}=require('../src/project.cjs');
const page=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>やくみ組 ローカル試写室</title><style>body{margin:32px auto;max-width:1100px;background:#10192a;color:#fff5da;font:18px system-ui;padding:0 20px}video,img{max-width:100%;border-radius:16px}a{color:#ace6df}h1{font-size:30px}p{line-height:1.7}</style><h1>やくみ組 ローカル試写室</h1><p>このページはこの端末だけで開きます。音声を配置していないドラフトには無音部分があります。</p><video controls preload="metadata" src="/preview.mp4"></video><p><a href="/video.mp4">完成版 MP4</a> · <a href="/subtitles.srt">字幕 SRT</a> · <a href="/thumbnail.png">サムネイル</a></p><h2>絵コンテ</h2><img src="/storyboard.png" alt="npm run stills で絵コンテを作成してください">`;
const allowed=new Map([['preview.mp4','video/mp4'],['video.mp4','video/mp4'],['storyboard.png','image/png'],['thumbnail.png','image/png'],['subtitles.srt','text/plain; charset=utf-8']]);
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?'':page);return;}
  const name=req.url?.slice(1);if(!allowed.has(name)){res.writeHead(404).end();return;}
  let f,size;try{f=inside(ROOT,'output/'+name);size=fs.statSync(f).size;}catch{res.writeHead(404).end('先に動画・素材を書き出してください。');return;}
  res.setHeader('Content-Type',allowed.get(name));res.setHeader('Accept-Ranges','bytes');
  let start=0,end=size-1;
  if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416).end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):end;if(start>end||start>=size){res.writeHead(416).end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}
  res.setHeader('Content-Length',end-start+1);
  if(req.method==='HEAD')res.end();else fs.createReadStream(f,{start,end}).on('error',()=>res.destroy()).pipe(res);
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173 / 終了は Ctrl+C'));

