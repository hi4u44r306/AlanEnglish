import {test} from 'node:test';import assert from 'node:assert/strict';
import {assessAzureAlphabet} from '../supabase/functions/_shared/speaking-azure-alphabet.ts';
const originalFetch=globalThis.fetch;
test('A–Z 保留音訊與參考字母，停用韻律，錯字母不通過',async()=>{
 try {for(const text of ['A','B']) {globalThis.fetch=async(url,options)=>{assert.match(String(url),/^https:\/\/southeastasia\.stt\.speech\.microsoft\.com/);const config=JSON.parse(atob(options.headers['Pronunciation-Assessment']));assert.equal(config.EnableProsodyAssessment,false);assert.equal(config.ReferenceText,'A');assert.equal(options.body.byteLength,2);return new Response(JSON.stringify({NBest:[{Display:text,PronunciationAssessment:{PronScore:86,AccuracyScore:88,FluencyScore:81}}]}));};const result=await assessAzureAlphabet(new ArrayBuffer(2),'A','synthetic','southeastasia');assert.equal(result.scores.pronunciation,86);assert.equal(result.scores.prosody,null);assert.equal(result.answer_match,text==='A');}}
 finally {globalThis.fetch=originalFetch;}
});
test('只回傳辨識文字或部分維度不會偽造成零分',async()=>{
 try {globalThis.fetch=async()=>new Response(JSON.stringify({NBest:[{Display:'A',AccuracyScore:88}]}));await assert.rejects(assessAzureAlphabet(new ArrayBuffer(2),'A','synthetic','southeastasia'),e=>e.code==='provider_failed');}
 finally {globalThis.fetch=originalFetch;}
});
test('設定、供應商或空白辨識錯誤不能當成功成績',async()=>{
 try {globalThis.fetch=async()=>{throw Error('must not call');};await assert.rejects(assessAzureAlphabet(new ArrayBuffer(2),'A','','southeastasia'),e=>e.code==='service_not_configured');globalThis.fetch=async()=>new Response('{}',{status:429});await assert.rejects(assessAzureAlphabet(new ArrayBuffer(2),'A','synthetic','southeastasia'),e=>e.code==='provider_failed');globalThis.fetch=async()=>new Response('{}');await assert.rejects(assessAzureAlphabet(new ArrayBuffer(2),'A','synthetic','southeastasia'),e=>e.code==='speech_no_match');}
 finally {globalThis.fetch=originalFetch;}
});
test('字母正確仍須 70 分；拼字使用分開的參考字母與聲音對齊結果',async()=>{
 try {
  for(const value of [69,70]){
   globalThis.fetch=async()=>new Response(JSON.stringify({NBest:[{Display:'A',PronunciationAssessment:{PronScore:value,AccuracyScore:80,FluencyScore:80}}]}));
   const result=await assessAzureAlphabet(new ArrayBuffer(2),'A','synthetic','southeastasia');assert.equal(result.answer_match,value>=70);
  }
  globalThis.fetch=async(url,options)=>{
   assert.equal(JSON.parse(atob(options.headers['Pronunciation-Assessment'])).ReferenceText,'C A T');
   return new Response(JSON.stringify({NBest:[{Display:'cat',PronunciationAssessment:{PronScore:82,AccuracyScore:85,FluencyScore:80},Words:['C','A','T'].map(Word=>({Word,AccuracyScore:85,ErrorType:'None'}))}]}));
  };
  const result=await assessAzureAlphabet(new ArrayBuffer(2),'CAT','synthetic','southeastasia','letter_spelling');assert.equal(result.answer_match,true);assert.equal(result.scores.pronunciation,82);
 }finally{globalThis.fetch=originalFetch;}
});
