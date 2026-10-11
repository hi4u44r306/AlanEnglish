import {useEffect,useRef,useState} from "react";
import {teamBossErrorMessage} from "../services/teamBossGameService";

// Read-only cursor. Interrupted/stale reads never advance it or animate another activity.
export default function useTeamBossBattle(client,activityId,revision){
 const cache=useRef({cursor:null,version:null,history:[]});
 const [state,setState]=useState({snapshot:null,history:[],arrivals:[],busy:true,error:""});
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  setState(previous=>({...previous,busy:true,error:"",arrivals:[]}));
  const load=async()=>{
   try{
    const first=cache.current.cursor===null,items=[];let cursor=cache.current.cursor,data;
    for(let page=0;page<5;page++){
     data=await client.readBattle(activityId,cursor);
     if(cancelled)return;
     if(data.activity_id!==activityId)throw Error("Activity changed");
     if(cache.current.version!==null&&cache.current.version!==data.team_version){
      data=await client.readBattle(activityId,null);if(cancelled)return;
      if(data.activity_id!==activityId)throw Error("Activity changed");
      items.length=0;items.push(...data.events);cursor=data.next_cursor;break;
     }
     if(cursor!==null&&(data.next_cursor<cursor||(data.has_more&&data.next_cursor===cursor)))throw Error("Invalid battle cursor");
     items.push(...data.events);cursor=data.next_cursor;if(!data.has_more)break;
    }
    const changed=cache.current.version!==null&&cache.current.version!==data.team_version;
    const unique=new Map((changed?[]:cache.current.history).map(item=>[item.id,item]));
    items.forEach(item=>unique.set(item.id,item));const history=[...unique.values()].sort((a,b)=>a.id-b.id).slice(-50);
    cache.current={cursor,version:data.team_version,history};
    setState({snapshot:data,history,arrivals:first||changed?[]:items,busy:false,error:""});
   }catch(error){if(!cancelled)setState(previous=>({...previous,busy:false,error:teamBossErrorMessage(error),arrivals:[]}));}
  };
  load();return()=>{cancelled=true;};
 },[client,activityId,revision,reload]);
 return{...state,refresh:()=>setReload(value=>value+1)};
}
