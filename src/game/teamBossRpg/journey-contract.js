export function validateJourneySources(data){
 if(!Array.isArray(data.journey_sources))return data.journey_sources===undefined;
 const seen=new Set();
 return data.journey_sources.length<=5000&&data.journey_sources.every(s=>{
  if(!s||typeof s!=="object")return false;
  const a=data.activities.find(a=>a.id===s.activity_id),t=a?.tasks.find(t=>t.id===s.task_id),key=s.activity_id+":"+s.task_id;
  if(!t?.available||!t.published||s.book_id!==4||typeof s.book_name!=="string"||s.book_name.length>100||!s.book_name
   ||!(s.unit_label===null||(typeof s.unit_label==="string"&&s.unit_label.length>0&&s.unit_label.length<=100))
   ||typeof s.title!=="string"||!s.title||s.title.length>100
   ||!Array.isArray(s.source_pages)||s.source_pages.length>100||s.source_pages.some(p=>!Number.isSafeInteger(p)||p<1||p>9999)
   ||new Set(s.source_pages).size!==s.source_pages.length||seen.has(key))return false;
  seen.add(key);return true;
 });
}
