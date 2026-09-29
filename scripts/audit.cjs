'use strict';
const fs=require('node:fs'),path=require('node:path');
const {ROOT}=require('../src/project.cjs');
const roots=['src','scripts','test','examples','docs','prompts','assets'];
const files=[];
function walk(p){for(const entry of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,entry.name);if(entry.isSymbolicLink())throw Error('公開候補にシンボリックリンクがあります。');if(entry.isDirectory())walk(f);else files.push(f);}}
roots.forEach(x=>walk(path.join(ROOT,x)));
for(const name of ['README.md','package.json','package-lock.json','AGENTS.md','LICENSE','ASSET-LICENSE.md','THIRD_PARTY_NOTICES.md'])files.push(path.join(ROOT,name));
const problems=[];
const secretPatterns=[/AIza[0-9A-Za-z_-]{35}/,/gh[pousr]_[A-Za-z0-9]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/sk-(?:proj-)?[A-Za-z0-9_-]{36,}/];
for(const file of files){
  const rel=path.relative(ROOT,file).replaceAll(path.sep,'/');
  if(fs.statSync(file).size>48*1024*1024)problems.push(rel+': large file');
  if(!/\.(cjs|json|md|txt|html)$/.test(file)&&!file.endsWith('LICENSE'))continue;
  const text=fs.readFileSync(file,'utf8');
  if(secretPatterns.some(p=>p.test(text)))problems.push(rel+': possible credential');
  if(/[A-Za-z]:[\\/]Users[\\/][^\s/'"]+/.test(text))problems.push(rel+': private absolute path');
  if((rel.startsWith('src/')||rel.startsWith('scripts/'))&&!['scripts/no-network.cjs','scripts/audit.cjs'].includes(rel)){
    if(/\bfetch\s*\(|\baxios\b|\bdotenv\b|@google\/genai|@anthropic-ai\/sdk|require\(['"]openai['"]\)|process\.env\.[A-Z_]*(?:KEY|TOKEN|SECRET)/.test(text))problems.push(rel+': API/auth code');
    if(/require\(['"](?:node:)?https['"]\)/.test(text))problems.push(rel+': outbound https import');
    if(rel!=='scripts/preview.cjs'&&/require\(['"](?:node:)?(?:http|net|tls)['"]\)/.test(text))problems.push(rel+': outbound network import');
  }
}
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log(`公開候補 ${files.length} ファイル: 秘密文字列・私的パス・AI API接続コードの検査 OK`);

