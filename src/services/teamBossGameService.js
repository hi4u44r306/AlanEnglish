import {parseClassRaidProfileRequest,projectClassRaidProfileRead} from '../game/teamBossRpg/class-raid-profiles-contract';
import {CLASS_RAID_ENCOUNTER_ACTION,parseClassRaidEncounterRequest,projectClassRaidEncounterResult,projectClassRaidEncounterRead,projectClassRaidEncounterStaffRead} from '../game/teamBossRpg/class-raid-encounter-contract';
import {parseClassRaidStaffRead,projectClassRaidStaffRead} from '../game/teamBossRpg/class-raid-staff-read-contract.js';
import {parseClassRaidReadRequest,projectClassRaidRead} from '../game/teamBossRpg/class-raid-read-contract';
import {CLASS_RAID_ACTIONS,CLASS_RAID_STAFF_ACTIONS,parseClassRaidRequest,projectClassRaidResult} from '../game/teamBossRpg/class-raid-contract';
import {receiptUuid,receiptTime,validateReceiptPage,validateReceiptLookup} from "../game/teamBossRpg/receipt-contract";
import {validateJourneySources} from "../game/teamBossRpg/journey-contract";
import { createReceiptJournal } from "./teamBossReceiptJournal";
import {validateStaffRulesResult} from "../game/teamBossRpg/staff-rules-contract";
import { staffActions, validateStaffContext } from "../game/teamBossRpg/staff-contract";
import { validateBattleState } from "../game/teamBossRpg/battle-state";
import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

import { RELIC_ACTIONS, validateRelicSummary, validateRelicResult, validateRelicReceipt } from "../game/teamBossRpg/relic-contract";

import { validateCollectionResult, validateCollectionReceipt } from "../game/teamBossRpg/gear-collection-contract";

export class TeamBossError extends Error {
    constructor(code, { uncertain = false } = {}) {
        super(code);
        this.code = code;
        this.uncertain = uncertain;
    }
}

const safeNumber = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000000;
function validateSummary(data) {
    if (!data || !safeNumber(data.balance) || !safeNumber(data.ledger_limit)
        || !["catalog", "inventory", "equipped", "activities", "ledger"].every(key => Array.isArray(data[key]))
        || data.equipped.length > 6
        || data.catalog.some(item => !safeNumber(item.id) || item.id === 0 || !safeNumber(item.price) || !safeNumber(item.catalog_version) || item.catalog_version === 0 || typeof item.asset_key !== "string" || typeof item.slot !== "string")
        || data.activities.some(item => !safeNumber(item.id) || !safeNumber(item.hp) || !safeNumber(item.max_hp) || item.max_hp === 0 || !Array.isArray(item.tasks) || !Array.isArray(item.teammates))) {
        throw new TeamBossError("invalid_response");
    }
    if(!validateJourneySources(data))throw new TeamBossError("invalid_response");
    return data;
}

export function validateCharacterProfile(data) {
    if (!data || !["boy-knight", "boy-mage", "girl-knight", "girl-mage"].includes(data.character_id)
        || !Number.isInteger(data.version) || data.version < 0 || data.version > 2147483647) throw new TeamBossError("invalid_response");
    return { character_id: data.character_id, version: data.version };
}

// Only game operations are sent here. Firebase and the database decide identity and eligibility.
export function createTeamBossClient(firebaseUser, { classRaidProfilesEnabled = false, bossEncounterEnabled = false, bossEncounterReadEnabled = false, classRaidStaffReadEnabled = false, fetcher = (...args) => fetch(...args), makeId = () => crypto.randomUUID(), channel = "economy", classRaidEnabled = false, classRaidReadEnabled = false, staffRulesEnabled = false, timeoutMs = 12000, journal = createReceiptJournal({ uid: firebaseUser?.uid, backend: supabaseUrl, channel }) } = {}) {
    let pending = null, inFlight = false, pendingUncertain = false, recoveryError = null;
    const storageError = error => new TeamBossError(error?.code === "receipt_storage_corrupt" ? error.code : "receipt_storage_unavailable", { uncertain: Boolean(pending) });
    async function restore() {
        try {
            pending = await journal.load();
            pendingUncertain = Boolean(pending); recoveryError = null;
        } catch (error) { recoveryError = storageError(error); throw recoveryError; }
    }
    async function prepare() {
        if (inFlight || !firebaseUser?.uid) return;
        try { await restore(); } catch { /* Reads remain available; writes require the journal. */ }
    }
    async function send(payload, mutation) {
        if (!firebaseUser?.uid) throw new TeamBossError("login_required");
        const controller = new AbortController();
        let timer;
        const work = (async () => {
            let token;
            try { token = await firebaseUser.getIdToken(); }
            catch (error) {
                if (error?.code === "auth/network-request-failed") throw new TeamBossError("connection_failed", { uncertain: mutation });
                throw new TeamBossError("login_required");
            }
            // A token resolving after the deadline must never send a late operation.
            if (controller.signal.aborted) throw new TeamBossError("connection_failed", { uncertain: mutation });
            let response, result;
            try {
                response = await fetcher(supabaseUrl + "/functions/v1/team-boss-game", {
                    method: "POST", signal: controller.signal,
                    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: supabaseKey },
                    body: JSON.stringify(payload)
                });
                result = await response.json();
            } catch { throw new TeamBossError("connection_failed", { uncertain: mutation }); }
            if (!response.ok || result?.ok !== true) throw new TeamBossError(result?.error?.code || "service_unavailable", { uncertain: mutation && response.status >= 500 });
            return result.data;
        })();
        try {
            return await Promise.race([work, new Promise((_resolve, reject) => {
                timer = setTimeout(() => { controller.abort(); reject(new TeamBossError("connection_failed", { uncertain: mutation })); },
                    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000);
            })]);
        } finally { clearTimeout(timer); }
    }
    async function readClassRaid(payload) {
        if(classRaidReadEnabled!==true)throw new TeamBossError('class_raid_read_not_available');
        let request;try{request=parseClassRaidReadRequest(payload);}catch{throw new TeamBossError('invalid_request');}
        await prepare();const data=await send(request,false);
        try{return bossEncounterReadEnabled===true?projectClassRaidEncounterRead(request,data):projectClassRaidRead(request,data);}catch{throw new TeamBossError('invalid_response');}
    }
    async function readClassProfile(payload) {
        if(classRaidProfilesEnabled!==true||classRaidReadEnabled!==true)throw new TeamBossError('class_profiles_not_available');
        let request;try{request=parseClassRaidProfileRequest(payload);}catch{throw new TeamBossError('invalid_request');}
        await prepare();const data=await send(request,false);
        try{return projectClassRaidProfileRead(request,data);}catch{throw new TeamBossError('invalid_response');}
    }
    async function verifyPendingReceipt() {
        // These canonical SQL endpoints replay their original UUID receipt before mutable rules.
        // The legacy receipt lookup has a different schema and must never be substituted.
        if (CLASS_RAID_ACTIONS.includes(pending.action)||pending.action===CLASS_RAID_ENCOUNTER_ACTION) return;
        if (pending.action === "purchase_collect") {
            try { validateCollectionReceipt(pending,await send({action:"purchase_collect_receipt",request_id:pending.request_id},false)); }
            catch (error) { throw new TeamBossError(error?.code || "invalid_response",{uncertain:true}); }
            return;
        }
        if (channel === "relic") {
            try { validateRelicReceipt(pending, await send({action:"relic_receipt",request_id:pending.request_id},false)); }
            catch (error) { throw new TeamBossError(error?.code || "invalid_response", {uncertain:true}); }
            return;
        }
        if (!receiptUuid(pending.request_id) || !["purchase", "equip", "unequip", "sync_learning", "claim_victory", "choose_character"].includes(pending.action)) throw new TeamBossError("invalid_response", { uncertain: true });
        let lookup;
        try { lookup = validateReceiptLookup(await send({ action: "receipt_lookup", request_id: pending.request_id }, false), pending.request_id); }
        catch (error) { throw new TeamBossError(error?.code || "invalid_response", { uncertain: true }); }
        if (lookup.state === "confirmed") {
            const receipt = lookup.receipt;
            if (receipt.action !== pending.action
                || (["purchase", "equip"].includes(pending.action) && receipt.item_id !== pending.item_id)
                || (pending.action === "unequip" && receipt.slot !== pending.slot)
                || (["sync_learning", "claim_victory"].includes(pending.action) && receipt.activity_id !== pending.activity_id)
                || (pending.action === "choose_character" && (receipt.character_id !== pending.character_id || receipt.version !== pending.expected_version + 1))) throw new TeamBossError("invalid_response", { uncertain: true });
        }
        // Lookup alone never clears an intent. Retry the canonical payload with its same UUID
        // so the server verifies its quote/version and returns the full original result.
    }
    async function release() {
        try { await journal.clear(pending.request_id); }
        catch (error) { recoveryError = storageError(error); recoveryError.uncertain = true; throw recoveryError; }
        pending = null; pendingUncertain = false;
    }
    async function perform() {
        try {
            if(pending.action===CLASS_RAID_ENCOUNTER_ACTION&&(bossEncounterEnabled!==true||classRaidEnabled!==true))throw new TeamBossError('boss_encounter_not_available',{uncertain:true});
            if(CLASS_RAID_ACTIONS.includes(pending.action)&&classRaidEnabled!==true)throw new TeamBossError('class_raid_not_available',{uncertain:true});
            const data = await send(pending, true);
            if(pending.action===CLASS_RAID_ENCOUNTER_ACTION){
                let result;try{result=projectClassRaidEncounterResult(pending,data);}catch{throw new TeamBossError('invalid_response',{uncertain:true});}
                await release();return result;
            }
            if(CLASS_RAID_ACTIONS.includes(pending.action)) {
                let result;try{result=projectClassRaidResult(pending,data);}catch{throw new TeamBossError('invalid_response',{uncertain:true});}
                await release();return result;
            }
            if (pending.action === "purchase_collect") {
                try { validateCollectionResult(pending,data); } catch { throw new TeamBossError("invalid_response",{uncertain:true}); }
                await release(); return data;
            }
            if (channel === "relic") {
                try { validateRelicResult(pending, data); } catch { throw new TeamBossError("invalid_response", {uncertain:true}); }
                await release(); return data;
            }
            const statuses = { set_activity_rules: ["rules_selected"], purchase: ["purchased", "already_owned"], equip: ["equipped"], unequip: ["unequipped"], sync_learning: ["learning_synced"], claim_victory: ["claimed"], choose_character: ["character_selected"], create_team: ["draft"], set_team_members: ["active"], save_activity: ["draft"], publish_activity: ["active"], close_activity: ["closed"] };
            if (!statuses[pending.action]?.includes(data?.status)) throw new TeamBossError("invalid_response", { uncertain: true });
            if (pending.action === "choose_character") {
                try {
                    validateCharacterProfile(data);
                    if (data.version === 0) throw new TeamBossError("invalid_response");
                } catch { throw new TeamBossError("invalid_response", { uncertain: true }); }
            }
            if (staffActions.includes(pending.action)) {
                const target = ["create_team", "set_team_members"].includes(pending.action) ? "team_id" : "activity_id";
                if (!safeNumber(data[target]) || !data[target] || !safeNumber(data.version) || !data.version
                    || (pending[target] && pending[target] !== data[target])
                    || (pending.action === "publish_activity" && !Number.isFinite(Date.parse(data.starts_at)))) throw new TeamBossError("invalid_response", { uncertain: true });
            }
            if (pending.action === "set_activity_rules") {
                try { validateStaffRulesResult(pending,data); } catch { throw new TeamBossError("invalid_response",{uncertain:true}); }
            }
            await release();
            return data;
        } catch (error) {
            // Access/token failure cannot resolve an operation already sent by this browser.
            if (pendingUncertain && ["login_required", "account_not_active", "identity_not_found", "student_not_eligible", "game_not_available", "game_disabled", "service_unavailable", "game_service_unavailable", "staff_not_eligible", "class_not_authorized", "team_not_authorized", "class_raid_not_authorized", "class_raid_not_available", "boss_encounter_not_available"].includes(error.code)) error.uncertain = true;
            if (error.uncertain) pendingUncertain = true;
            else await release();
            throw error;
        } finally { inFlight = false; }
    }
    return {
        prepare,
        read: async () => { await prepare(); return validateSummary(await send({ action: "summary" }, false)); },
        readClassRaidSummary: (afterActivityId=null)=>readClassRaid({action:'class_raid_summary',after_activity_id:afterActivityId}),
        readClassRaidBattle: (activityId,afterEventId=null)=>readClassRaid({action:'class_raid_battle',activity_id:activityId,after_event_id:afterEventId}),
        readClassRaidNames: (activityId,afterPosition=0)=>readClassProfile({action:'class_raid_names',activity_id:activityId,after_position:afterPosition}),
        readClassRaidProfile: (activityId,memberKey)=>readClassProfile({action:'class_raid_profile',activity_id:activityId,member_key:memberKey}),
        readBattle: async (activityId, afterEventId = null) => {
            const data = await send({ action: "battle_state", activity_id: activityId, after_event_id: afterEventId }, false);
            try { return validateBattleState(data); } catch { throw new TeamBossError("invalid_response"); }
        },
        readClassRaidStaff: async (activityId,review=null) => {
            if(classRaidStaffReadEnabled!==true)throw new TeamBossError('class_raid_staff_read_not_available');
            let p;try{if(review!==null&&(!review||typeof review!=='object'||Array.isArray(review)||Object.keys(review).sort().join('|')!=='config|grace_seconds'))throw Error('Invalid review');p=parseClassRaidStaffRead(review!==null?{action:'class_raid_staff_preview',activity_id:activityId,...review}:{action:'class_raid_staff_state',activity_id:activityId});}catch{throw new TeamBossError('invalid_request');}
            await prepare();const data=await send(p,false);try{return bossEncounterReadEnabled===true?projectClassRaidEncounterStaffRead(p,data):projectClassRaidStaffRead(p,data);}catch{throw new TeamBossError('invalid_response');}
        },
        readStaff: async (classCode = null) => {
            await prepare();
            const data = await send({ action: "staff_context", class_code: classCode }, false);
            try { return validateStaffContext(data,{staffRulesEnabled}); } catch { throw new TeamBossError("invalid_response"); }
        },
        readReceiptPage: async (before=null) => {
            if(before&&(!receiptUuid(before.request_id)||!receiptTime(before.created_at)))throw new TeamBossError("invalid_cursor");
            const data=await send({action:"receipt_history",before_time:before?.created_at||null,before_request_id:before?.request_id||null},false);
            try{return validateReceiptPage(data,before);}catch{throw new TeamBossError("invalid_response");}
        },
        lookupReceipt: async requestId => {
            if(!receiptUuid(requestId))throw new TeamBossError("invalid_uuid");
            const data=await send({action:"receipt_lookup",request_id:requestId},false);
            try{return validateReceiptLookup(data,requestId);}catch{throw new TeamBossError("invalid_response");}
        },
        readRelics: async (kind = "speaking_question") => {
            await prepare(); const data = await send({action:"relic_summary",kind},false);
            try { return validateRelicSummary(data,kind); } catch { throw new TeamBossError("invalid_response"); }
        },
        readCharacter: async () => { await prepare(); return validateCharacterProfile(await send({ action: "character_profile" }, false)); },
        get pending() { return pending ? { action: pending.action, request_id: pending.request_id, ...(pending.activity_id ? { activity_id: pending.activity_id } : {}) } : null; },
        get recoveryError() { return recoveryError; },
        async mutate(payload) {
            if(payload?.action===CLASS_RAID_ENCOUNTER_ACTION){
                if(bossEncounterEnabled!==true||classRaidEnabled!==true)throw new TeamBossError('boss_encounter_not_available');
                if(channel!=="staff")throw new TeamBossError('invalid_request');
                try{parseClassRaidEncounterRequest({...payload,request_id:'00000000-0000-4000-8000-000000000000'});}catch{throw new TeamBossError('invalid_request');}
            }
            if(CLASS_RAID_ACTIONS.includes(payload?.action)) {
                if(classRaidEnabled!==true)throw new TeamBossError('class_raid_not_available');
                if(channel!==(CLASS_RAID_STAFF_ACTIONS.includes(payload.action)?'staff':'class-raid'))throw new TeamBossError('invalid_request');
                try{parseClassRaidRequest({...payload,request_id:'00000000-0000-4000-8000-000000000000'});}catch{throw new TeamBossError('invalid_request');}
            }
            if (payload?.action === "set_activity_rules" && staffRulesEnabled !== true) throw new TeamBossError("activity_rules_not_available");
            if ((channel === "relic") !== RELIC_ACTIONS.includes(payload?.action)) throw new TeamBossError("invalid_request");
            if (!firebaseUser?.uid) throw new TeamBossError("login_required");
            if (inFlight || pending) throw new TeamBossError("operation_pending");
            inFlight = true;
            try {
                await restore();
                if (pending) throw new TeamBossError("operation_pending");
                const candidate = JSON.parse(JSON.stringify({ ...payload, request_id: makeId() }));
                const result = await journal.reserve(candidate);
                pending = result.payload;
                if (!result.reserved) { pendingUncertain = true; throw new TeamBossError("operation_pending"); }
            } catch (error) {
                inFlight = false;
                if (error instanceof TeamBossError) throw error;
                recoveryError = storageError(error); throw recoveryError;
            }
            return perform();
        },
        async retry({ verifyReceipt = false } = {}) {
            if (inFlight) throw new TeamBossError("operation_pending");
            inFlight = true;
            try {
                await restore();
                if (!pending) throw new TeamBossError("no_pending_operation");
                if (verifyReceipt) await verifyPendingReceipt();
            } catch (error) { inFlight = false; throw error; }
            return perform();
        }
    };
}

export const teamBossErrorMessage = error => ({
    class_profiles_not_available: "角色資料目前無法讀取，請稍後重新確認。",
    class_profile_not_authorized: "目前無法查看這位同學的資料，請重新讀取班級戰況。",
    boss_encounter_not_available: "Boss 選擇或身份讀取暫時無法使用，原待確認交易會保留。",
    encounter_selection_required: "請先選擇並保存本場 Boss，再重新核對發布內容。",
    encounter_class_publication_required: "已選 Boss 的活動請使用班級共同挑戰發布。",
    encounter_changed: "Boss 選擇已變更，請重新讀取活動並確認。",
    encounter_immutable: "本場 Boss 已固定，無法變更。",
    class_raid_staff_read_not_available: "老師班級發布核對暫未開放，請稍後再試。",
    class_raid_read_not_available: "班級戰況暫時無法讀取，請稍後重試；原成果會保留。",
    class_raid_not_available: "班級 Boss 暫未開放，原待確認交易會保留。",
    class_raid_not_authorized: "目前無法參加這一班的 Boss，請向老師確認。",
    class_raid_reward_window_frozen: "本場領獎期限已固定，請重新讀取活動。",
    game_not_available: "團隊冒險尚未開放。",
    game_disabled: "團隊冒險尚未開放。",
    login_required: "請重新登入，再回到團隊冒險。",
    student_not_eligible: "目前只開放有效在學的英文班學生。",
    insufficient_coins: "金幣不足，先完成學習任務再來挑選。",
    collection_purchases_not_available: "裝備收藏購買暫未開放，原收藏與待確認交易會保留。",
    relics_not_available: "寶物暫未開放，原收藏與待確認交易會保留。",
    relic_loadout_changed: "寶物已在其他裝置更新，請重新讀取再穿戴。",
    quote_changed: "價格已更新，請重新讀取後再確認購買。",
    character_changed: "角色已在其他裝置更新，請重新讀取後再設定。",
    catalog_changed: "裝備價格已更新，請重新整理後再確認。",
    item_not_owned: "請先購買這件裝備。",
    game_content_not_authorized: "目前沒有這份教材的使用權限。",
    book_not_authorized: "目前沒有這份教材的使用權限。",
    daily_source_limit: "今日可結算次數已達上限。",
    daily_coin_limit: "今日遊戲金幣已達上限。",
    content_not_authorized: "目前沒有這份教材的使用權限。",
    connection_failed: "連線中斷，請重試。交易結果未確認時，請使用「重試原交易」。",
    receipt_storage_unavailable: "暫時無法保存交易收據，已停止新交易。請確認瀏覽器允許網站儲存後再重新整理；原學習仍可使用。",
    receipt_storage_corrupt: "待確認收據無法讀取，已停止交易。請保留此瀏覽器資料並聯絡老師協助確認。",
    operation_pending: "上一筆交易尚未確認，請先重試原交易。",
    activity_not_open: "活動已結束或尚未開始，請重新整理。",
    participation_required: "完成活動任務後才能領取通關獎勵。"
}[error?.code] || "暫時無法完成，請重新整理或稍後重試。");

export function teamBossSyncMessage(result) {
    if (result?.status !== "learning_synced") return "成果已確認，請重新整理小隊資料。";
    const message = result.settled_count > 0 ? "已同步 " + result.settled_count + " 筆學習成果，獲得 " + result.coins + " 遊戲金幣，造成 " + result.damage + " 傷害。" : "目前沒有新的可結算學習成果。";
    const reason = { batch_limit: "還有成果待處理，可再同步一次。", daily_source_limit: "今日可結算次數已達上限。", daily_coin_limit: "今日遊戲金幣已達上限。", activity_won: "小隊已通關，可回冒險頁查看獎勵。", activity_ended: "活動已結束。" }[result.stop_reason] || "";
    return message + reason;
}
