// Future Bosses provide their own asset, rig, aim anchors, palette and sound score.
export const BOOK_DRAGON_PROFILE=Object.freeze({id:'book-dragon',name:'月光書龍',asset:'src/game/assets/book-dragon.png',rig:'book-dragon-weighted-v1',mouth:[.235,.31],hit:[.43,.58],palette:{core:'#f9e4ff',beam:'#aa87ff',rim:'#596af4'},attack:{chargeStart:720,fireStart:890,end:1080},sounds:{
 'blade-air':[[620,170,0,.18,'triangle',.045]],'blade-wave':[[420,120,0,.24,'triangle',.06],[920,380,0,.13,'sine',.035]],
 'magic-charge':[[440,880,0,.34,'sine',.035],[660,1320,.07,.32,'sine',.025],[880,1760,.14,.28,'sine',.025]],
 'magic-ray':[[1100,240,0,.26,'sawtooth',.025],[330,660,0,.32,'triangle',.045],[1760,880,0,.19,'sine',.025]],
 'impact':[[100,42,0,.28,'triangle',.09],[480,180,.01,.16,'sine',.025]],
 'boss-charge':[[65,110,0,.28,'triangle',.08],[130,180,0,.3,'sine',.035]],
 'boss-ray':[[88,38,0,.38,'sawtooth',.025],[120,55,.01,.4,'triangle',.055],[260,80,.02,.25,'sine',.035]],
 'victory':[[523,523,0,.17,'sine',.05],[659,659,.1,.17,'sine',.05],[784,784,.2,.2,'sine',.05],[1046,1046,.32,.34,'sine',.045]]}});
export function weaponEffect(item){return ['star-wand','sun-wand'].includes(item)?'magic':'blade';}

export const BOSS_PROFILES=Object.freeze({[BOOK_DRAGON_PROFILE.id]:BOOK_DRAGON_PROFILE});
