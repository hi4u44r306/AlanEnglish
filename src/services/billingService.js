import { callEdgeFunction } from "./edgeFunctionClient";

const callBilling = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("billing-manager", firebaseUser, { action, ...payload })
);

export const createCheckoutSession = (firebaseUser, planId) => callBilling(firebaseUser, "create_checkout", { plan_id: planId });
export const createBillingPortal = firebaseUser => callBilling(firebaseUser, "create_portal");
export const syncBillingSession = (firebaseUser, sessionId) => callBilling(firebaseUser, "sync", { session_id: sessionId || undefined });
