import { callEdgeFunction } from "./edgeFunctionClient";

const callLegacyCleanup = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("legacy-cleanup", firebaseUser, { action, ...payload })
);

export const auditLegacyData = firebaseUser => callLegacyCleanup(firebaseUser, "audit");
export const listLegacyBackups = firebaseUser => callLegacyCleanup(firebaseUser, "list_backups");
export const backupLegacyData = (firebaseUser, firebaseUids) => callLegacyCleanup(firebaseUser, "backup", { firebase_uids: firebaseUids });
export const cleanupLegacyData = (firebaseUser, firebaseUids, confirmPhrase, force = false) => callLegacyCleanup(firebaseUser, "cleanup", {
    firebase_uids: firebaseUids,
    confirm_phrase: confirmPhrase,
    force
});
