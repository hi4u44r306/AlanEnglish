import {BOOK_DRAGON_PROFILE} from './boss-profiles.mjs';
const region=(center,radius,pivot,amplitude,speed,phase=0)=>({center,radius,pivot,amplitude,speed,phase});
const spec=[
 ['moon-book-dragon','月光書龍','星頁吐息','dragon',[.21,.32],[.44,.57],['#f9e4ff','#aa87ff','#596af4'],[
 region([.30,.23],[.28,.28],[.37,.44],1.8,1.1),region([.15,.43],[.21,.36],[.28,.49],-3,1.3),region([.77,.35],[.30,.35],[.51,.43],3,1.3),region([.86,.74],[.22,.22],[.67,.77],4,.9)],80,'triangle'],
 ['moss-stone-guardian','森苔巨像','森岩重擊','earth',[.28,.66],[.47,.48],['#eeffd9','#9dd678','#437e68'],[
 region([.36,.20],[.25,.25],[.40,.35],1,1.6),region([.18,.56],[.22,.28],[.28,.37],-2,1.4),region([.78,.65],[.27,.28],[.67,.37],2.8,1.4,.5)],46,'sine'],
 ['frost-nine-tail-fox','霜晶靈狐','霜晶連矢','ice',[.19,.34],[.43,.62],['#ffffff','#a0eaff','#568bcf'],[
 region([.27,.25],[.25,.27],[.34,.46],2,1.25),region([.75,.26],[.28,.30],[.69,.65],3.2,1.2),region([.87,.50],[.20,.30],[.69,.65],-3.3,1.05,.8),region([.79,.70],[.24,.20],[.64,.68],2.4,.9,1.2)],660,'sine'],
 ['sunfire-lion','焰日獅王','焰日咆哮','fire',[.22,.35],[.42,.55],['#fff2bb','#ffad46','#dc5f46'],[
 region([.32,.30],[.31,.31],[.40,.48],1.8,1.1),region([.53,.32],[.22,.32],[.41,.45],-1.6,.8),region([.86,.61],[.22,.31],[.69,.76],4,1.25)],105,'sawtooth'],
 ['storm-griffin','雷霆獅鷲','雷羽閃擊','storm',[.21,.29],[.41,.55],['#f0fcff','#92e9ff','#a89aee'],[
 region([.31,.22],[.27,.24],[.35,.40],1.6,1.1),region([.16,.40],[.21,.34],[.28,.47],-3.5,1),region([.76,.37],[.29,.34],[.54,.46],4,1),region([.85,.77],[.24,.18],[.64,.75],3.4,.85)],220,'square'],
 ['ink-tide-kraken','墨潮章魚王','墨潮漩渦','tide',[.38,.50],[.51,.45],['#cffff8','#6cdfd5','#856adb'],[
 region([.53,.26],[.34,.29],[.51,.51],1.7,1.4),region([.16,.51],[.19,.24],[.37,.57],4,.8),region([.83,.44],[.19,.22],[.60,.55],-4,.9,.6),region([.19,.78],[.23,.22],[.38,.63],3.1,1.05,1),region([.71,.82],[.27,.19],[.55,.65],-3,1.1,1.8)],155,'triangle']
];
export const EXPANSION_PROFILES=Object.freeze(spec.map(([id,name,attackName,effect,mouth,hit,colors,regions,base,wave])=>Object.freeze({
 ...BOOK_DRAGON_PROFILE,id,name,attackName,effect,mouth,hit,rig:id+'-mesh-v1',regions,
 palette:{core:colors[0],beam:colors[1],rim:colors[2]},
 sounds:{...BOOK_DRAGON_PROFILE.sounds,
 'boss-charge':[[base,base*1.8,0,.28,wave,.055],[base*2,base*2.4,.03,.30,'sine',.025]],
 'boss-ray':[[base*1.5,base*.55,0,.35,wave,.05],[base*2.5,base*.85,.025,.28,'triangle',.04],[base*4,base*1.3,.08,.18,'sine',.023]],
 'boss-hit':[[base*1.25,base*.6,0,.16,'triangle',.04]],
 'boss-defeat':[[base*2,base*.35,0,.62,'triangle',.045],[base*3,base*.7,.06,.5,'sine',.023]]
 }
})));
