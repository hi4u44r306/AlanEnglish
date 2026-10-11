import React,{useEffect,useMemo,useRef,useState} from 'react';
import {EXPANSION_PROFILES} from '../../game/teamBossRpg/native/bosses/expansion-profiles.mjs';
import {EXPANSION_ART} from '../../game/teamBossRpg/native/bosses/boss-assets';
import {bossMesh,bossPose,bossVertex} from '../../game/teamBossRpg/native/bosses/boss-presentation.mjs';
import {createBossRenderer} from '../../game/teamBossRpg/native/bosses/boss-webgl.mjs';
// The caller selects an authorized encounter; this renderer does not select or settle an activity.
export default function TeamBossEncounterArt({bossId='moon-book-dragon',event=null,step=0,motion=false,won=false}){
 const profile=EXPANSION_PROFILES.find(p=>p.id===bossId),artwork=EXPANSION_ART[bossId];
 const host=useRef(null),canvas=useRef(null),driver=useRef(null),clock=useRef({event:null,step:0,at:0}),input=useRef(null),mesh=useMemo(()=>bossMesh(),[]);
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);input.current={event,step,motion,won,profile};
 useEffect(()=>{
  let alive=true;const node=host.current,surface=canvas.current;if(!profile||!artwork||!surface)return undefined;
  const image=new Image(),fallback=()=>{if(alive){node.dataset.bossRenderer='static';setReady(false);}};
  const install=()=>{if(!alive)return;driver.current?.dispose();driver.current=createBossRenderer(surface,mesh,image);if(driver.current)setReady(true);else fallback();};
  const lost=e=>{e.preventDefault();driver.current?.dispose();driver.current=null;fallback();};surface.addEventListener('webglcontextlost',lost);surface.addEventListener('webglcontextrestored',install);
  setReady(false);setFailed(false);image.onload=install;image.onerror=()=>{fallback();if(alive)setFailed(true);};image.src=artwork;
  return()=>{alive=false;image.onload=null;image.onerror=null;surface.removeEventListener('webglcontextlost',lost);surface.removeEventListener('webglcontextrestored',install);driver.current?.dispose();driver.current=null;};
 },[artwork,profile,mesh]);
 useEffect(()=>{
  if(!ready)return undefined;let raf=null;const node=host.current,media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const draw=now=>{const value=input.current,rest=!value.motion||document.hidden||media?.matches;if(clock.current.event!==value.event||clock.current.step!==value.step)clock.current={event:value.event,step:value.step,at:now};
   const elapsed=value.event?value.step*180+Math.min(179.999,Math.max(0,now-clock.current.at)):now;
   const pose=bossPose(elapsed,{...value,motion:!rest}),vertices=mesh.vertices.map(p=>bossVertex(p,pose));
   if(!driver.current?.draw(vertices)){node.dataset.bossRenderer='static';setReady(false);return;}
   node.dataset.bossRenderer='webgl';node.dataset.bossAnimation=pose.phase;node.dataset.bossElapsed=elapsed.toFixed(2);node.dataset.bossStep=String(value.step);node.dataset.bossEvent=String(value.event?.id||'');node.dataset.meshSample=vertices.filter((_,i)=>i%30===0).flat().map(v=>v.toFixed(2)).join(',');node.style.setProperty('--boss-flash',String(pose.hit*.35));node.style.setProperty('--boss-glow',String(pose.charge*.8));node.style.setProperty('--boss-rune',String(pose.charge));
   if(!rest)raf=requestAnimationFrame(draw);
  };
  const restart=()=>{if(raf!==null)cancelAnimationFrame(raf);raf=null;draw(performance.now());};restart();document.addEventListener('visibilitychange',restart);media?.addEventListener('change',restart);
  return()=>{if(raf!==null)cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',restart);media?.removeEventListener('change',restart);};
 },[ready,mesh,motion,event,won]);
 if(!profile||!artwork)return <div className="tb-encounter-art" role="status">Boss造型尚未設定。</div>;
 return <div ref={host} className="tb-encounter-art" data-boss-profile={bossId} data-boss-renderer="static" data-boss-animation="rest" role="img" aria-label={profile.name+'：待機、受擊、已確認反擊與退場'}><div className="tb-encounter-rune" aria-hidden="true"/><img className="tb-encounter-fallback" src={artwork} alt=""/><canvas ref={canvas} aria-hidden="true"/>{failed&&<span role="status">Boss造型載入失敗，學習成果仍保留。</span>}</div>;
}
