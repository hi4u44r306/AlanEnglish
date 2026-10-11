import {CLASS_RAID_ENCOUNTER_ACTION,validClassRaidEncounterIntent} from '../game/teamBossRpg/class-raid-encounter-contract';
import { staffActions, validateStaffIntent } from "../game/teamBossRpg/staff-contract";
import { validRelicIntent } from "../game/teamBossRpg/relic-contract";
import { validCollectionIntent } from "../game/teamBossRpg/gear-collection-contract";
import {CLASS_RAID_ACTIONS,CLASS_RAID_STAFF_ACTIONS,validClassRaidIntent} from '../game/teamBossRpg/class-raid-contract';
// Pending intent only: no token, UID, balance, source proof or authority lives here.
const DATABASE = "alanenglish-team-boss-receipts-v1", STORE = "pending";
const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000000000;
const slots = ["weapon", "shield", "head", "cape", "armor", "boots"];
const characters = ["boy-knight", "boy-mage", "girl-knight", "girl-mage"];
export class ReceiptJournalError extends Error {
    constructor(code) { super(code); this.code = code; }
}
export function validateReceiptPayload(payload, channel = "economy") {
    if(payload?.action===CLASS_RAID_ENCOUNTER_ACTION){
        if(channel!=="staff"||!validClassRaidEncounterIntent(payload))throw new ReceiptJournalError("receipt_storage_corrupt");
        return JSON.parse(JSON.stringify(payload));
    }
    if (CLASS_RAID_ACTIONS.includes(payload?.action)) {
        const expected=CLASS_RAID_STAFF_ACTIONS.includes(payload.action)?'staff':'class-raid';
        if(channel!==expected||!validClassRaidIntent(payload))throw new ReceiptJournalError('receipt_storage_corrupt');
        return JSON.parse(JSON.stringify(payload));
    }
    if (payload?.action === "purchase_collect") {
        if (channel !== "economy" || !validCollectionIntent(payload)) throw new ReceiptJournalError("receipt_storage_corrupt");
        return JSON.parse(JSON.stringify(payload));
    }
    if (channel === "relic") {
        if (!validRelicIntent(payload)) throw new ReceiptJournalError("receipt_storage_corrupt");
        return JSON.parse(JSON.stringify(payload));
    }
    const staff = staffActions.includes(payload?.action);
    if (staff) {
        if (channel !== "staff" || !validateStaffIntent(payload) || typeof payload.request_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.request_id)) throw new ReceiptJournalError("receipt_storage_corrupt");
        return JSON.parse(JSON.stringify(payload));
    }
    const schema = {
        purchase: ["action", "request_id", "item_id", "catalog_version"],
        equip: ["action", "request_id", "item_id"], unequip: ["action", "request_id", "slot"],
        sync_learning: ["action", "request_id", "activity_id"], claim_victory: ["action", "request_id", "activity_id"],
        choose_character: ["action", "request_id", "character_id", "expected_version"]
    };
    const fail = () => { throw new ReceiptJournalError("receipt_storage_corrupt"); };
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(schema[payload.action])
        || Object.keys(payload).sort().join("|") !== schema[payload.action].slice().sort().join("|")
        || !["economy", "character"].includes(channel)
        || (channel === "character") !== (payload.action === "choose_character")
        || typeof payload.request_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.request_id)) return fail();
    if (["purchase", "equip"].includes(payload.action) && !positive(payload.item_id)) return fail();
    if (payload.action === "purchase" && !positive(payload.catalog_version)) return fail();
    if (payload.action === "unequip" && !slots.includes(payload.slot)) return fail();
    if (["sync_learning", "claim_victory"].includes(payload.action) && !positive(payload.activity_id)) return fail();
    if (payload.action === "choose_character" && (!characters.includes(payload.character_id)
        || !Number.isInteger(payload.expected_version) || payload.expected_version < 0 || payload.expected_version > 2147483647)) return fail();
    return JSON.parse(JSON.stringify(payload));
}
export function createReceiptJournal({ uid, backend, channel = "economy" }) {
    let connection;
    const open = () => {
        if (!connection) connection = (async () => {
            if (!uid || !["economy", "character", "staff", "relic", "class-raid"].includes(channel) || !window.indexedDB || !window.crypto?.subtle) throw new ReceiptJournalError("receipt_storage_unavailable");
            const bytes = new TextEncoder().encode(JSON.stringify(["ae-game-v1", backend, uid, channel]));
            const hash = await crypto.subtle.digest("SHA-256", bytes);
            const scope = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open(DATABASE, 1);
                request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "scope" });
                request.onerror = request.onblocked = () => reject(new ReceiptJournalError("receipt_storage_unavailable"));
                request.onsuccess = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(STORE)) { db.close(); reject(new ReceiptJournalError("receipt_storage_corrupt")); return; }
                    db.onversionchange = () => { db.close(); connection = null; };
                    resolve(db);
                };
            });
            return { db, scope };
        })().catch(error => { connection = null; throw error; });
        return connection;
    };
    async function run(mode, operation) {
        const { db, scope } = await open();
        return new Promise((resolve, reject) => {
            let result, failure;
            try {
                // Reserve and compare-delete finish in one readwrite transaction, including across tabs.
                const transaction = db.transaction(STORE, mode), store = transaction.objectStore(STORE);
                transaction.oncomplete = () => resolve(result);
                transaction.onabort = transaction.onerror = () => reject(failure || new ReceiptJournalError("receipt_storage_unavailable"));
                const read = store.get(scope);
                read.onsuccess = () => {
                    try {
                        const row = read.result;
                        if (row && (row.format !== 1 || Object.keys(row).sort().join("|") !== "format|payload|scope" || row.scope !== scope)) throw new ReceiptJournalError("receipt_storage_corrupt");
                        const payload = row ? validateReceiptPayload(row.payload, channel) : null;
                        result = operation(store, scope, payload);
                    } catch (error) { failure = error; transaction.abort(); }
                };
            } catch (error) { reject(error instanceof ReceiptJournalError ? error : new ReceiptJournalError("receipt_storage_unavailable")); }
        });
    }
    return {
        load: () => run("readonly", (_store, _scope, payload) => payload),
        reserve: candidate => {
            const payload = validateReceiptPayload(candidate, channel);
            return run("readwrite", (store, scope, existing) => {
                if (existing) return { reserved: false, payload: existing };
                store.add({ scope, format: 1, payload });
                return { reserved: true, payload };
            });
        },
        clear: requestId => run("readwrite", (store, scope, payload) => {
            if (payload?.request_id === requestId) store.delete(scope);
        })
    };
}
