import {validateActivityRules, STAFF_RULE_PROFILES} from "./staff-rules-contract";
// Local intent validation only. Firebase and SQL decide identity, rights and versions.
const classes = ["E1", "E3", "E5", "E7"];
const id = v => Number.isSafeInteger(v) && v > 0 && v <= 1000000000000;
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v, max = 100) => typeof v === "string" && v.trim().length > 0 && v.length <= max && Array.from(v).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127);
const list = (v, max) => Array.isArray(v) && v.length <= max;
const ids = (v, min, max) => list(v, max) && v.length >= min && v.every(id) && new Set(v).size === v.length;
const date = v => typeof v === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const keys = (v, expected) => v && !Array.isArray(v) && Object.keys(v).sort().join("|") === expected.slice().sort().join("|");
export const staffActions = ["set_activity_rules", "create_team", "set_team_members", "save_activity", "publish_activity", "close_activity"];
export function validateStaffIntent(p) {
    const schema = {
        set_activity_rules: ["action", "request_id", "activity_id", "expected_version", "profile"],
        create_team: ["action", "request_id", "class_code", "name", "capacity"],
        set_team_members: ["action", "request_id", "team_id", "student_ids", "expected_version"],
        save_activity: ["action", "request_id", "team_id", "activity_id", "expected_version", "starts_at", "ends_at", "max_hp", "victory_coins", "minimum_sources", "tasks"],
        publish_activity: ["action", "request_id", "activity_id", "expected_version", "team_version"],
        close_activity: ["action", "request_id", "activity_id", "expected_version"]
    };
    if (!schema[p?.action] || !keys(p, schema[p.action])) return false;
    if (p.action === "set_activity_rules") return id(p.activity_id) && id(p.expected_version) && STAFF_RULE_PROFILES.includes(p.profile);
    if (p.action === "create_team") return classes.includes(p.class_code) && text(p.name, 60) && integer(p.capacity, 2, 5);
    if (p.action === "set_team_members") return id(p.team_id) && id(p.expected_version) && ids(p.student_ids, 1, 5);
    if (p.action === "save_activity") return id(p.team_id)
        && ((p.activity_id === null && p.expected_version === null) || (id(p.activity_id) && id(p.expected_version)))
        && date(p.starts_at) && date(p.ends_at) && Date.parse(p.ends_at) > Date.parse(p.starts_at)
        && integer(p.max_hp, 1, 1000000) && integer(p.victory_coins, 0, 500) && integer(p.minimum_sources, 1, 100)
        && list(p.tasks, 50) && p.tasks.every(t => keys(t, ["kind", "content_id", "question_ids", "coins", "damage"])
            && ["speaking_question", "listening_session"].includes(t.kind) && id(t.content_id)
            && ids(t.question_ids, t.kind === "speaking_question" ? 1 : 0, t.kind === "speaking_question" ? 100 : 0)
            && integer(t.coins, 0, 100) && integer(t.damage, 1, 1000));
    return id(p.activity_id) && id(p.expected_version) && (p.action !== "publish_activity" || id(p.team_version));
}
export function validateStaffContext(d, {staffRulesEnabled=false} = {}) {
    const fail = () => { throw new Error("invalid staff response"); };
    if (!d || !list(d.classes, 4) || !d.classes.length || new Set(d.classes).size !== d.classes.length || !d.classes.every(c => classes.includes(c))
        || !d.classes.includes(d.class_code) || d.summary?.class_code !== d.class_code
        || !list(d.summary.roster, 500) || !list(d.summary.teams, 100) || !list(d.summary.activities, 100)
        || !list(d.roster_names, 500) || !list(d.sources, 100) || !list(d.contributions, 5000) || typeof d.contributions_truncated !== "boolean") return fail();
    const roster = d.summary.roster.map(r => r.student_id);
    if (!ids(roster, 0, 500) || d.roster_names.length !== roster.length || !ids(d.roster_names.map(r => r.student_id), 0, 500)
        || d.roster_names.some(r => !roster.includes(r.student_id) || !text(r.display_name))) return fail();
    for (const t of d.summary.teams) if (!id(t.id) || !id(t.version) || !text(t.name) || !["draft", "active", "archived"].includes(t.status)
        || !integer(t.capacity, 2, 5) || !list(t.members, 500) || t.members.some(m => !id(m.student_id) || !["active", "left", "removed"].includes(m.status))) return fail();
    for (const a of d.summary.activities) if (!id(a.id) || !id(a.version) || !d.summary.teams.some(t => t.id === a.team_id)
        || !["draft", "active", "won", "closed"].includes(a.status) || !date(a.starts_at) || !date(a.ends_at)
        || !integer(a.max_hp, 1, 1000000) || !integer(a.hp, 0, a.max_hp) || !integer(a.victory_coins, 0, 500)
        || !integer(a.minimum_sources, 1, 100) || !list(a.tasks, 50) || a.tasks.some(t => !id(t.id)
            || !["speaking_question", "listening_session"].includes(t.kind) || typeof t.available !== "boolean" || typeof t.published !== "boolean"
            || (t.available ? !id(t.content_id) : t.content_id !== null) || !ids(t.question_ids, 0, 100)
            || !integer(t.coins, 0, 100) || !integer(t.damage, 1, 1000))) return fail();
    if (new Set(d.sources.map(s => s.kind + ":" + s.content_id)).size !== d.sources.length || d.sources.some(s => !id(s.content_id) || s.book_id !== 4
        || !text(s.label) || typeof s.pages_known !== "boolean" || !["speaking_question", "listening_session"].includes(s.kind)
        || !ids(s.question_ids, s.kind === "speaking_question" ? 1 : 0, s.kind === "speaking_question" ? 100 : 0))) return fail();
    if (new Set(d.contributions.map(c => c.activity_id + ":" + c.student_id)).size !== d.contributions.length
        || d.contributions.some(c => !d.summary.activities.some(a => a.id === c.activity_id) || !id(c.student_id) || !text(c.display_name)
            || !integer(c.sources, 1, 1000000000000) || !integer(c.damage, 1, 1000000000000) || typeof c.claimed !== "boolean")) return fail();
    let enabled;
    for (const a of d.summary.activities) {
        if (staffRulesEnabled) {
            const rules=validateActivityRules(a.battle_rules,a.status);
            if (enabled !== undefined && enabled !== rules.selection_enabled) return fail();
            enabled=rules.selection_enabled;
        } else if (Object.prototype.hasOwnProperty.call(a,"battle_rules")) return fail();
    }
    return d;
}
