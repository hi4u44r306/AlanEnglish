import React,{useEffect,useRef} from 'react';
import './TeamBossClassProfileCard.scss';
export default function TeamBossClassProfileCard({card,onClose}){
 const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const node=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';if(node.showModal)node.showModal();else node.setAttribute('open','');
  node.querySelector('button')?.focus();const back=()=>close.current();window.addEventListener('popstate',back);
  return()=>{window.removeEventListener('popstate',back);if(node.close)node.close();document.body.style.overflow=overflow;previous?.focus?.();};
 },[]);
 const trapTab=event=>{
  if(event.key!=='Tab')return;
  const items=[...dialog.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')],first=items[0],last=items.at(-1);
  if(first&&((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)||!dialog.current.contains(document.activeElement))){event.preventDefault();(event.shiftKey?last:first).focus();}
 };
 const data=card.data,amount=value=>value.toLocaleString('zh-TW');
 return <dialog ref={dialog} className="tb-class-profile-card" aria-label="冒險者資料" onKeyDown={trapTab} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target!==dialog.current)return;const rect=dialog.current.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();}}>
  <header><div><small>ADVENTURER PROFILE</small><h2>{data?.available?(data.nickname||data.alias):'冒險者資料'}</h2></div><button type="button" onClick={onClose} aria-label="關閉角色資料">✕</button></header>
  <div className="tb-class-profile-body" aria-busy={card.busy}>
   {card.busy&&<p role="status">正在確認這位冒險者的資料…</p>}
   {card.error&&<p role="alert">{card.error}</p>}
   {data&&!data.available&&<p role="status">目前無法查看這位同學的個人資料。原本的班級貢獻仍會保留。</p>}
   {data?.available&&<><span className="tb-class-profile-tag">{data.is_me?'我的冒險者':'同班冒險夥伴'} · {data.class_code}</span>
    <dl className="tb-class-profile-identity"><div><dt>暱稱</dt><dd>{data.nickname||'尚未設定'}</dd></div><div><dt>真名</dt><dd>{data.real_name||'目前未提供'}</dd></div><div><dt>班級</dt><dd>{data.class_code}</dd></div><div><dt>等級</dt><dd>{data.stats?'Lv. '+data.stats.level:'等級未公開'}</dd></div></dl>
    <div className="tb-class-profile-contribution"><div><small>本輪貢獻傷害</small><strong>{amount(data.damage)}</strong></div><div><small>有效學習成果</small><strong>{amount(data.sources)}<span> 次</span></strong></div></div>
    <p className="tb-class-profile-note">{data.sources===0?'還沒出手也沒關係，每一份有效英文學習都能幫助全班。':'每一份英文學習，都是全班一起前進的力量。'}</p>
    {!data.stats&&<p className="tb-class-profile-privacy">等級依同學的統計可見設定顯示。</p>}
   </>}
  </div>
 </dialog>;
}
