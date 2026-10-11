// Purchase intent stays in the original economy journal; old purchase is never rewritten.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).sort().join('|') === keys.slice().sort().join('|');
const positive = v => Number.isSafeInteger(v) && v > 0;
const amount = v => Number.isSafeInteger(v) && v >= 0 && v <= 1000000000000;
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const fail = () => { throw new Error('invalid_response'); };
export function validCollectionIntent(p) {
 return exact(p,['action','item_id','catalog_version','request_id']) && p.action === 'purchase_collect' && positive(p.item_id) && positive(p.catalog_version) && uuid(p.request_id);
}
export function validateCollectionResult(p,r) {
 if (!object(r) || !['purchased_to_collection','collected_already_owned'].includes(r.status) || r.item_id !== p.item_id || !amount(r.balance) || !amount(r.charged) || r.auto_equipped !== false || (r.status === 'collected_already_owned' && r.charged !== 0)) fail();
 return r;
}
export function validateCollectionReceipt(p,r) {
 if (!object(r) || r.status !== 'purchase_collect_receipt' || r.request_id !== p.request_id) fail();
 if (r.state === 'not_found') return r;
 if (r.state !== 'confirmed' || typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at)) || !exact(r.payload,['action','item_id','catalog_version']) || r.payload.action !== p.action || r.payload.item_id !== p.item_id || r.payload.catalog_version !== p.catalog_version) fail();
 validateCollectionResult(p,r.result);return r;
}
