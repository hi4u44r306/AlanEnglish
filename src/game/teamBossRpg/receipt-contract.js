const statuses={purchase:["purchased","already_owned"],purchase_collect:["purchased_to_collection","collected_already_owned"],equip:["equipped"],unequip:["unequipped"],choose_character:["character_selected"],sync_learning:["learning_synced"],claim_victory:["claimed"],contribute:["contributed"]};
export const receiptActions={purchase:"購買裝備",purchase_collect:"購買收藏",equip:"穿戴裝備",unequip:"卸下裝備",choose_character:"設定角色",sync_learning:"同步學習",claim_victory:"領取通關獎勵",contribute:"學習貢獻"};
export const receiptUuid=value=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const receiptTime=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,19)===value.slice(0,19);
const num=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000000,id=n=>num(n)&&n>0;
const slots=["weapon","shield","head","cape","armor","boots"],characters=["boy-knight","boy-mage","girl-knight","girl-mage"];
const keys=["request_id","action","status","created_at","item_id","asset_key","slot","activity_id","character_id","version","charged","awarded"];
const fail=()=>{throw Error("invalid_receipt_response");};
export function validateOperationReceipt(r){
 if(!r||typeof r!=="object"||!receiptUuid(r.request_id)||!receiptTime(r.created_at)||!statuses[r.action]?.includes(r.status)
  ||![r.item_id,r.activity_id].every(n=>n===null||id(n))||![r.version,r.charged,r.awarded].every(n=>n===null||num(n))
  ||!(r.asset_key===null||(typeof r.asset_key==="string"&&/^[a-z0-9-]{1,80}$/.test(r.asset_key)))
  ||!(r.slot===null||slots.includes(r.slot))||!(r.character_id===null||characters.includes(r.character_id)))fail();
 if((["purchase","purchase_collect","equip"].includes(r.action)&&!id(r.item_id))||(["equip","unequip"].includes(r.action)&&!slots.includes(r.slot))
  ||(["purchase","purchase_collect"].includes(r.action)&&!num(r.charged))||(r.action==="choose_character"&&(!characters.includes(r.character_id)||!id(r.version)))
  ||(["sync_learning","claim_victory","contribute"].includes(r.action)&&(!id(r.activity_id)||!num(r.awarded))))fail();
 if(r.action==="purchase_collect"&&r.status==="collected_already_owned"&&r.charged!==0)fail();
 return Object.fromEntries(keys.map(k=>[k,r[k]]));
}
const earlier=(a,b)=>a.created_at<b.created_at||(a.created_at===b.created_at&&a.request_id<b.request_id);
export function validateReceiptPage(data,before=null){
 if(!data||data.page_size!==20||!Array.isArray(data.items)||data.items.length>20)fail();
 const items=data.items.map(validateOperationReceipt),seen=new Set();
 for(let i=0;i<items.length;i++){if(seen.has(items[i].request_id)||(i>0&&!earlier(items[i],items[i-1]))||(before&&!earlier(items[i],before)))fail();seen.add(items[i].request_id);}
 const c=data.next_cursor,last=items[items.length-1];
 if(c!==null&&(!c||items.length!==20||c.created_at!==last.created_at||c.request_id!==last.request_id))fail();
 return{items,page_size:20,next_cursor:c?{created_at:c.created_at,request_id:c.request_id}:null};
}
export function validateReceiptLookup(data,requestId){
 if(!data||!["confirmed","not_found"].includes(data.state))fail();
 if(data.state==="not_found"){if(data.receipt!==null)fail();return{state:"not_found",receipt:null};}
 const receipt=validateOperationReceipt(data.receipt);if(receipt.request_id!==requestId)fail();return{state:"confirmed",receipt};
}
