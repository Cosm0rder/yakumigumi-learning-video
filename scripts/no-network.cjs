'use strict';
// Test preload: render commands must work without outbound Node networking.
const deny=()=>{throw Error('Offline verification blocked an outbound network attempt');};
globalThis.fetch=deny;
for(const protocol of ['node:http','node:https']){
  const mod=require(protocol);mod.request=deny;mod.get=deny;
}
const net=require('node:net');net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;
const tls=require('node:tls');tls.connect=deny;
const dns=require('node:dns');dns.lookup=deny;dns.resolve=deny;
if(dns.promises){dns.promises.lookup=deny;dns.promises.resolve=deny;}

