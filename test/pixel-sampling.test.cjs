'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {nearestAxis,sampleNearestRgba}=require('../src/pixel-sampling.cjs');

test('nearest sampling pins exact center ties without blending RGBA channels',()=>{
  assert.deepEqual(nearestAxis(4,3),[0,2,3]);
  assert.deepEqual(nearestAxis(4,3,[1]),[0,1,3]);
  assert.deepEqual(nearestAxis(2,1),[1]);
  assert.deepEqual(nearestAxis(2,1,[0]),[0]);
  const rgba=new Uint8ClampedArray([1,2,3,128,11,12,13,129,21,22,23,254,31,32,33,255]);
  assert.deepEqual([...sampleNearestRgba(rgba,2,2,1,1,{x:[],y:[]})],[31,32,33,255]);
  assert.deepEqual([...sampleNearestRgba(rgba,2,2,1,1,{x:[0],y:[]})],[21,22,23,254]);
  assert.deepEqual([...sampleNearestRgba(rgba,2,2,1,1,{x:[],y:[0]})],[11,12,13,129]);
  assert.deepEqual([...sampleNearestRgba(rgba,2,2,1,1,{x:[0],y:[0]})],[1,2,3,128]);
});

test('nearest sampling rejects overrides away from exact equidistant boundaries',()=>{
  for(const lower of [[0],[2],[-1],[3],[1,1],[1,0],[1.5],['1'],null])assert.throws(()=>nearestAxis(4,3,lower));
  for(const dimensions of [[0,1],[1,0],[-1,1],[1.5,1],[Infinity,1],[Number.MAX_SAFE_INTEGER,2]])assert.throws(()=>nearestAxis(...dimensions));
  const rgba=new Uint8ClampedArray([1,2,3,128]);
  for(const ties of [undefined,{x:[]},{x:[],y:[],z:[]}])assert.throws(()=>sampleNearestRgba(rgba,1,1,1,1,ties));
  assert.throws(()=>sampleNearestRgba(new Uint8Array(3),1,1,1,1,{x:[],y:[]}));
});
