import {validateRelicProgressState} from "./relic-progress-contract";
import {validateRelicBattleState} from "./relic-battle-contract";
import { validateResults } from "./results";
import { validateSkills } from "./skills";
import { validateTeamwork } from "./teamwork";
import { validateBossPhases } from "./boss-phases";
// Wire validation only. The backend remains the authority for membership and settlement.
const characters = ["boy-knight", "boy-mage", "girl-knight", "girl-mage"];
const slots = ["weapon", "shield", "head", "cape", "armor", "boots"];
const key = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000000;
const text = value => typeof value === "string" && value.length > 0 && value.length <= 100 && Array.from(value).every(character => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; });
export function validateBattleState(data) {
    const bad = () => { throw new Error("invalid battle response"); };
    if (!data || !integer(data.activity_id) || !data.activity_id || !text(data.team_name) || !integer(data.team_version) || !data.team_version
        || !["active", "won", "closed"].includes(data.status) || !integer(data.hp) || !integer(data.max_hp) || !data.max_hp || data.hp > data.max_hp
        || (data.status === "won" && data.hp !== 0) || (data.status === "active" && data.hp === 0) || !Array.isArray(data.members) || !data.members.length || data.members.length > 5
        || !Array.isArray(data.events) || data.events.length > 50 || !integer(data.latest_event_id) || !integer(data.next_cursor)
        || data.next_cursor > data.latest_event_id || typeof data.has_more !== "boolean" || typeof data.has_older !== "boolean"
        || (data.has_more && data.next_cursor >= data.latest_event_id)) return bad();
    const keys = new Set(), seen = new Set(); let me = 0, previous = 0;
    for (const m of data.members) {
        if (!key(m.member_key) || keys.has(m.member_key) || !text(m.alias) || typeof m.is_me !== "boolean"
            || !characters.includes(m.character_id) || !integer(m.character_version) || m.character_version > 2147483647
            || !integer(m.sources) || !integer(m.damage) || !Array.isArray(m.loadout) || m.loadout.length > 6) return bad();
        keys.add(m.member_key); if (m.is_me) me++;
        const used = new Set();
        for (const item of m.loadout) {
            if (!slots.includes(item.slot) || used.has(item.slot) || typeof item.asset_key !== "string" || !/^[a-z0-9-]{1,80}$/.test(item.asset_key)) return bad();
            used.add(item.slot);
        }
    }
    if (me !== 1) return bad();
    for (const e of data.events) {
        if (!integer(e.id) || e.id <= previous || seen.has(e.id) || e.id > data.latest_event_id
            || (e.member_key !== null && !keys.has(e.member_key)) || !["speaking_question", "listening_session"].includes(e.kind)
            || !integer(e.damage) || !e.damage || !integer(e.hp_after) || e.hp_after + e.damage > data.max_hp
            || typeof e.won !== "boolean" || e.won !== (e.hp_after === 0)
            || typeof e.settled_at !== "string" || !Number.isFinite(Date.parse(e.settled_at))) return bad();
        seen.add(e.id); previous = e.id;
    }
    if (data.events.length && previous !== data.next_cursor) return bad();
    validateBossPhases(data);validateTeamwork(data);validateSkills(data);validateResults(data);validateRelicBattleState(data);validateRelicProgressState(data);
    return data;
}
