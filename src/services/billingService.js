import { callEdgeFunction } from "./edgeFunctionClient";

const callBilling = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("billing-manager", firebaseUser, { action, ...payload })
);

export const createCheckoutSession = (firebaseUser, planId) => callBilling(firebaseUser, "create_checkout", { plan_id: planId });
export const createBillingPortal = firebaseUser => callBilling(firebaseUser, "create_portal");
export const syncBillingSession = (firebaseUser, sessionId) => callBilling(firebaseUser, "sync", { checkout_session_id: sessionId || undefined });
export const createMaterialCheckout = (firebaseUser, packageId) => callBilling(firebaseUser, "create_material_checkout", { package_id: packageId });
export const cancelSubscriptionAtPeriodEnd = (firebaseUser, subscriptionId) => callBilling(firebaseUser, "cancel_at_period_end", { subscription_id: subscriptionId || undefined });
export const resumeSubscription = (firebaseUser, subscriptionId) => callBilling(firebaseUser, "resume_subscription", { subscription_id: subscriptionId || undefined });
