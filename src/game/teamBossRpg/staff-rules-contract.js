// Candidate metadata only; actual effects and authority remain in the backend.
export const STAFF_RULE_PROFILES = ["standard", "relic-attack-v1", "relic-progress-v1"];
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join("|") === keys.slice().sort().join("|");
export function staffRuleAllowed(installed, profile) {
    return STAFF_RULE_PROFILES.includes(installed) && STAFF_RULE_PROFILES.includes(profile)
        && !(installed === "relic-progress-v1" && profile !== installed)
        && !(installed === "relic-attack-v1" && profile === "standard");
}
export function validateActivityRules(value, status) {
    if (!exact(value, ["profile", "installed_profile", "selection_saved", "selection_enabled"])
        || typeof value.selection_saved !== "boolean" || typeof value.selection_enabled !== "boolean"
        || !staffRuleAllowed(value.installed_profile, value.profile)
        || ((!value.selection_saved || status !== "draft") && value.profile !== value.installed_profile)) throw new Error("invalid activity rules");
    return { ...value };
}
export function validateStaffRulesResult(intent, data) {
    if (!exact(data, ["status", "activity_id", "version", "profile"]) || data.status !== "rules_selected"
        || data.activity_id !== intent.activity_id || data.version !== intent.expected_version + 1 || data.profile !== intent.profile) throw new Error("invalid rules receipt");
    return data;
}
