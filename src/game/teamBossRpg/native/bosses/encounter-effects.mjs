// Accepted six Boss attack painters, adapted to the trusted serialized recoil beat.
const mix=(a,b,t)=>a+(b-a)*t,clamp=t=>Math.max(0,Math.min(1,t));
export function drawBossAttack(ctx,a,b,t,profile){
 const {chargeStart,fireStart,end}=profile.attack,c=profile.palette,fire=t>=fireStart,p=clamp((t-fireStart)/(end-fireStart));
 ctx.save();ctx.globalAlpha=fire?1-clamp((p-.65)/.35):clamp((t-chargeStart)/100);ctx.strokeStyle=c.beam;ctx.fillStyle=c.beam;ctx.shadowColor=c.beam;ctx.shadowBlur=12;ctx.lineWidth=3;
 if(!fire){for(let i=0;i<7;i++){const r=18+Math.sin(t/80)*4,angle=t/180+i*Math.PI*2/7;ctx.beginPath();ctx.arc(a.x+Math.cos(angle)*r,a.y+Math.sin(angle)*r,2+i%2,0,Math.PI*2);ctx.fill();}ctx.restore();return;}
 const x=mix(a.x,b.x,clamp(p*3)),y=mix(a.y,b.y,clamp(p*3)),angle=Math.atan2(b.y-a.y,b.x-a.x),distance=Math.hypot(x-a.x,y-a.y);
 if(profile.effect==='earth'){
  ctx.translate(x,y+18);ctx.scale(1,.38);for(let j=0;j<3;j++){ctx.beginPath();ctx.arc(0,0,8+p*60+j*13,0,Math.PI*2);ctx.stroke();}
  ctx.scale(1,1/.38);for(let i=0;i<7;i++){const q=i*2.4,dx=Math.cos(q)*p*43,dy=-Math.sin(Math.PI*p)*(10+i*5);ctx.save();ctx.translate(dx,dy);ctx.rotate(q+p);ctx.fillRect(-4,-5,8,10);ctx.restore();}
 }else if(profile.effect==='ice'){
  for(let i=0;i<5;i++){const q=clamp(p*2-i*.1),px=mix(a.x,b.x,q),py=mix(a.y,b.y,q)+(i-2)*9*Math.sin(q*Math.PI);ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(-3,-5);ctx.lineTo(-10,0);ctx.lineTo(-3,5);ctx.closePath();ctx.fill();ctx.strokeStyle=c.core;ctx.lineWidth=1;ctx.stroke();ctx.restore();}
 }else if(profile.effect==='fire'){
  ctx.translate(a.x,a.y);ctx.rotate(angle);const gradient=ctx.createLinearGradient(0,0,Math.max(1,distance),0);gradient.addColorStop(0,c.core);gradient.addColorStop(.5,c.beam);gradient.addColorStop(1,c.rim);ctx.fillStyle=gradient;
  for(let j=0;j<5;j++){const spread=10+j*3;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(distance*.55,-spread,distance,Math.sin(t/22+j)*14);ctx.quadraticCurveTo(distance*.6,spread,0,0);ctx.fill();}
 }else if(profile.effect==='storm'){
  for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(a.x,a.y);for(let i=1;i<=12;i++){const f=i/12,offset=i===12?0:Math.sin(i*2.7+t/32+j)*14;ctx.lineTo(mix(a.x,x,f)-Math.sin(angle)*offset,mix(a.y,y,f)+Math.cos(angle)*offset);}ctx.strokeStyle=j===2?c.core:c.beam;ctx.lineWidth=j===2?1:3;ctx.stroke();}
 }else if(profile.effect==='tide'){
  for(let j=0;j<4;j++){const q=clamp(p*2-j*.12),px=mix(a.x,b.x,q),py=mix(a.y,b.y,q);ctx.beginPath();ctx.ellipse(px,py,8+j*2,18+j*4,angle+Math.PI/2,t/150+j,t/150+j+Math.PI*1.65);ctx.strokeStyle=j%2?c.rim:c.beam;ctx.lineWidth=4;ctx.stroke();}
 }else{for(const [w,color]of [[17,c.rim],[7,c.beam],[2,c.core]]){ctx.lineWidth=w;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(x,y);ctx.stroke();}}
 ctx.restore();
}
