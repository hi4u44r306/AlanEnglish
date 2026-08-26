import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { isAiAddonPlanCode } from "../_shared/membership-pricing.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
});
const cleanText = (value: unknown, maxLength = 500) => String(value || "")
    .trim()
    .slice(0, maxLength);

const toIsoFromSeconds = (value: unknown) => {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0
        ? new Date(seconds * 1000).toISOString()
        : null;
};

const stripeId = (value: unknown) => {
    if (typeof value === "string") return cleanText(value, 300);
    if (value && typeof value === "object") return cleanText((value as any).id, 300);
    return "";
};

const subscriptionPeriodEnd = (subscription: any) => {
    const candidates = [
        subscription?.current_period_end,
        ...(Array.isArray(subscription?.items?.data)
            ? subscription.items.data.map((item: any) => item?.current_period_end)
            : [])
    ].map(Number).filter(value => Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.max(...candidates) : null;
};

const subscriptionPeriodStart = (subscription: any) => {
    const candidates = [
        subscription?.current_period_start,
        subscription?.start_date,
        ...(Array.isArray(subscription?.items?.data)
            ? subscription.items.data.map((item: any) => item?.current_period_start)
            : [])
    ].map(Number).filter(value => Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.min(...candidates) : null;
};

const invoicePeriodEnd = (invoice: any) => {
    const candidates = [
        invoice?.period_end,
        ...(Array.isArray(invoice?.lines?.data)
            ? invoice.lines.data.map((line: any) => line?.period?.end)
            : [])
    ].map(Number).filter(value => Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.max(...candidates) : null;
};

const invoiceSubscriptionId = (invoice: any) => stripeId(
    invoice?.subscription || invoice?.parent?.subscription_details?.subscription
);

const invoicePaymentIntentId = (invoice: any) => {
    const legacyId = stripeId(invoice?.payment_intent);
    if (legacyId) return legacyId;
    const payments = Array.isArray(invoice?.payments?.data) ? invoice.payments.data : [];
    const paymentIntent = payments.find((payment: any) => payment?.payment?.type === "payment_intent");
    return stripeId(paymentIntent?.payment?.payment_intent);
};

const timingSafeEqual = (left: string, right: string) => {
    if (left.length !== right.length) return false;
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
};

const hmacSha256Hex = async (secret: string, payload: string) => {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = new Uint8Array(await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payload)
    ));
    return Array.from(signature).map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const verifyStripeSignature = async (
    rawBody: string,
    signatureHeader: string,
    webhookSecret: string
) => {
    const fields = signatureHeader.split(",").map(part => part.trim());
    const timestamp = Number(fields.find(part => part.startsWith("t="))?.slice(2));
    const signatures = fields
        .filter(part => part.startsWith("v1="))
        .map(part => part.slice(3));
    if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
    if (age > 300) return false;
    const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
    return signatures.some(signature => timingSafeEqual(signature, expected));
};

const mapSubscriptionStatus = (status: string) => {
    if (status === "trialing") return "trialing";
    if (status === "active") return "active";
    if (["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"].includes(status)) {
        return "past_due";
    }
    if (status === "canceled") return "cancelled";
    return "past_due";
};

const invoicePeriodStart = (invoice: any) => {
    const candidates = [
        invoice?.period_start,
        ...(Array.isArray(invoice?.lines?.data)
            ? invoice.lines.data.map((line: any) => line?.period?.start)
            : [])
    ].map(Number).filter(value => Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.min(...candidates) : null;
};

const mapSubscriptionGrantStatus = (status: string) => {
    if (["active", "trialing"].includes(status)) return "active";
    if (status === "canceled") return "expired";
    return "paused";
};

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
        return json(500, { error: "Webhook server configuration is incomplete" });
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get("stripe-signature") || "";
    if (!(await verifyStripeSignature(rawBody, signatureHeader, webhookSecret))) {
        return json(400, { error: "Invalid Stripe signature" });
    }

    let event: any;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return json(400, { error: "Invalid JSON" });
    }

    const eventId = cleanText(event?.id, 300);
    const eventType = cleanText(event?.type, 200);
    if (!eventId || !eventType) return json(400, { error: "Invalid Stripe event" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: insertedEvent, error: eventInsertError } = await admin
        .from("payment_events")
        .insert({
            stripe_event_id: eventId,
            event_type: eventType,
            livemode: event?.livemode === true,
            payload: event,
            status: "received"
        })
        .select("id,status,received_at")
        .maybeSingle();

    let eventRecordId = insertedEvent?.id || null;
    if (eventInsertError) {
        if (eventInsertError.code === "23505") {
            const { data: existing, error: existingError } = await admin
                .from("payment_events")
                .select("id,status,received_at")
                .eq("stripe_event_id", eventId)
                .maybeSingle();
            if (existingError || !existing) {
                console.error("Stripe duplicate lookup failed", existingError);
                return json(500, { error: "Unable to load recorded event" });
            }
            if (["processed", "ignored"].includes(existing.status)) {
                return json(200, { received: true, duplicate: true });
            }
            const receivedAt = new Date(existing.received_at || 0).getTime();
            if (existing.status === "received" && Date.now() - receivedAt < 2 * 60 * 1000) {
                return json(200, { received: true, duplicate: true, processing: true });
            }
            const { error: retryError } = await admin
                .from("payment_events")
                .update({
                    event_type: eventType,
                    livemode: event?.livemode === true,
                    payload: event,
                    status: "received",
                    error_message: null,
                    received_at: new Date().toISOString(),
                    processed_at: null
                })
                .eq("id", existing.id);
            if (retryError) {
                console.error("Stripe event retry setup failed", retryError);
                return json(500, { error: "Unable to retry event" });
            }
            eventRecordId = existing.id;
        } else {
            console.error("Stripe event insert failed", eventInsertError);
            return json(500, { error: "Unable to record event" });
        }
    }
    if (!eventRecordId) return json(500, { error: "Unable to identify recorded event" });

    const object = event?.data?.object || {};
    const metadata = object?.metadata || {};
    const subscriptionMetadata = object?.parent?.subscription_details?.metadata || {};
    const eventMetadata = { ...subscriptionMetadata, ...metadata };
    const studentId = Number(eventMetadata.student_id || object.client_reference_id || 0) || null;
    const planId = Number(eventMetadata.plan_id || 0) || null;

    try {
        let handled = false;
        if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
            handled = true;
            const membershipId = Number(metadata.membership_id || 0) || null;
            if (!membershipId || !studentId || !planId) {
                throw new Error("Checkout Session metadata is incomplete");
            }
            const customerId = stripeId(object.customer) || null;
            const subscriptionId = stripeId(object.subscription) || null;
            const { data: membership, error: membershipError } = await admin
                .from("memberships")
                .select("id,student_id")
                .eq("id", membershipId)
                .eq("student_id", studentId)
                .maybeSingle();
            if (membershipError) throw membershipError;
            if (!membership) throw new Error("Checkout Session does not match a membership");

            let accessGrantId: number | null = null;
            if (eventMetadata.grant_mode === "additive") {
                if (!subscriptionId) throw new Error("Add-on Checkout Session is missing a subscription");
                const { data: addonPlan, error: addonPlanError } = await admin
                    .from("subscription_plans")
                    .select("id,code,access_model")
                    .eq("id", planId)
                    .eq("enabled", true)
                    .maybeSingle();
                if (addonPlanError) throw addonPlanError;
                if (!addonPlan || addonPlan.access_model !== "addon" || !isAiAddonPlanCode(addonPlan.code)) {
                    throw new Error("Checkout Session plan is not an add-on");
                }
                const { data: existingGrant, error: existingGrantError } = await admin
                    .from("student_access_grants")
                    .select("id")
                    .eq("stripe_subscription_id", subscriptionId)
                    .maybeSingle();
                if (existingGrantError) throw existingGrantError;

                // Stripe 不保證不同事件類型的抵達順序。若 subscription 或 invoice
                // 已先啟用權限，晚到的 checkout 事件只能補齊識別欄位，不能降回 pending。
                const grantMutation = existingGrant
                    ? admin
                        .from("student_access_grants")
                        .update({
                            stripe_customer_id: customerId,
                            stripe_checkout_session_id: cleanText(object.id, 300),
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", existingGrant.id)
                    : admin
                        .from("student_access_grants")
                        .insert({
                            student_id: studentId,
                            plan_id: planId,
                            source: "stripe",
                            status: "pending",
                            starts_at: new Date().toISOString(),
                            stripe_customer_id: customerId,
                            stripe_subscription_id: subscriptionId,
                            stripe_checkout_session_id: cleanText(object.id, 300),
                            stripe_subscription_status: cleanText(object.payment_status || object.status, 60),
                            metadata: {
                                plan_code: addonPlan.code,
                                grant_mode: "additive",
                                checkout_payment_status: cleanText(object.payment_status, 60)
                            },
                            updated_at: new Date().toISOString()
                        });
                const { data: accessGrant, error: grantError } = await grantMutation
                    .select("id")
                    .single();
                if (grantError) throw grantError;
                accessGrantId = Number(accessGrant.id);
                if (customerId) {
                    const { error: customerSaveError } = await admin
                        .from("memberships")
                        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
                        .eq("id", membership.id);
                    if (customerSaveError) throw customerSaveError;
                }
            } else {
                const checkoutMembershipStatus = object.payment_status === "paid" ? "active" : "trialing";
                const { error: membershipUpdateError } = await admin
                    .from("memberships")
                    .update({
                        plan_id: planId,
                        status: checkoutMembershipStatus,
                        source: "stripe",
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        stripe_subscription_status: checkoutMembershipStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", membership.id);
                if (membershipUpdateError) throw membershipUpdateError;
            }

            const { error: transactionError } = await admin.from("payment_transactions").upsert({
                student_id: membership?.student_id || studentId,
                membership_id: membership?.id || membershipId,
                access_grant_id: accessGrantId,
                stripe_event_id: eventId,
                stripe_checkout_session_id: cleanText(object.id, 300),
                stripe_payment_intent_id: stripeId(object.payment_intent) || null,
                amount_total: Number.isFinite(Number(object.amount_total)) ? Number(object.amount_total) : null,
                currency: cleanText(object.currency, 20) || null,
                status: cleanText(object.payment_status || object.status, 80) || "completed",
                occurred_at: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()
            }, { onConflict: "stripe_checkout_session_id" });
            if (transactionError) throw transactionError;
        } else if (eventType.startsWith("customer.subscription.")) {
            handled = true;
            const subscriptionId = stripeId(object.id);
            const customerId = stripeId(object.customer);
            const stripeStatus = cleanText(object.status, 60);
            const currentPeriodEnd = toIsoFromSeconds(subscriptionPeriodEnd(object));
            if (eventMetadata.grant_mode === "additive") {
                if (!subscriptionId || !studentId || !planId) {
                    throw new Error("Add-on subscription metadata is incomplete");
                }
                const { data: addonPlan, error: addonPlanError } = await admin
                    .from("subscription_plans")
                    .select("id,code,access_model")
                    .eq("id", planId)
                    .eq("enabled", true)
                    .maybeSingle();
                if (addonPlanError) throw addonPlanError;
                if (!addonPlan || addonPlan.access_model !== "addon" || !isAiAddonPlanCode(addonPlan.code)) {
                    throw new Error("Subscription plan is not an add-on");
                }
                const startsAt = toIsoFromSeconds(subscriptionPeriodStart(object)) || new Date().toISOString();
                const grantStatus = eventType === "customer.subscription.deleted"
                    ? "expired"
                    : mapSubscriptionGrantStatus(stripeStatus);
                const endsAt = currentPeriodEnd || (grantStatus === "expired" ? new Date().toISOString() : null);
                if (grantStatus === "active" && !endsAt) {
                    throw new Error("Active add-on subscription is missing its period end");
                }
                const { error: grantError } = await admin
                    .from("student_access_grants")
                    .upsert({
                        student_id: studentId,
                        plan_id: planId,
                        source: "stripe",
                        status: grantStatus,
                        starts_at: startsAt,
                        ends_at: endsAt,
                        revoked_at: grantStatus === "expired" ? new Date().toISOString() : null,
                        revoke_reason: grantStatus === "expired" ? "stripe_subscription_cancelled" : null,
                        stripe_customer_id: customerId || null,
                        stripe_subscription_id: subscriptionId,
                        stripe_subscription_status: stripeStatus,
                        current_period_end: currentPeriodEnd,
                        cancel_at_period_end: Boolean(object.cancel_at_period_end),
                        metadata: {
                            plan_code: addonPlan.code,
                            grant_mode: "additive",
                            last_event_type: eventType
                        },
                        updated_at: new Date().toISOString()
                    }, { onConflict: "stripe_subscription_id" });
                if (grantError) throw grantError;
            } else {
                const mappedStatus = eventType === "customer.subscription.deleted"
                    ? "cancelled"
                    : mapSubscriptionStatus(stripeStatus);
                let lookup = admin
                    .from("memberships")
                    .select("id,student_id,access_ends_at")
                    .eq("stripe_subscription_id", subscriptionId)
                    .maybeSingle();
                let { data: membership, error: membershipLookupError } = await lookup;
                if (membershipLookupError) throw membershipLookupError;
                if (!membership && customerId) {
                    const result = await admin
                        .from("memberships")
                        .select("id,student_id,access_ends_at")
                        .eq("stripe_customer_id", customerId)
                        .maybeSingle();
                    if (result.error) throw result.error;
                    membership = result.data;
                }
                if (!membership && studentId) {
                    const result = await admin
                        .from("memberships")
                        .select("id,student_id,access_ends_at")
                        .eq("student_id", studentId)
                        .maybeSingle();
                    if (result.error) throw result.error;
                    membership = result.data;
                }
                if (membership) {
                    const membershipUpdates: Record<string, unknown> = {
                        status: mappedStatus,
                        source: "stripe",
                        stripe_subscription_id: subscriptionId,
                        stripe_subscription_status: stripeStatus,
                        current_period_end: currentPeriodEnd,
                        access_ends_at: currentPeriodEnd || membership.access_ends_at,
                        cancel_at_period_end: Boolean(object.cancel_at_period_end),
                        updated_at: new Date().toISOString()
                    };
                    if (planId) membershipUpdates.plan_id = planId;
                    if (customerId) membershipUpdates.stripe_customer_id = customerId;
                    const { error: updateError } = await admin
                        .from("memberships")
                        .update(membershipUpdates)
                        .eq("id", membership.id);
                    if (updateError) throw updateError;
                }
            }
        } else if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
            handled = true;
            const customerId = stripeId(object.customer);
            const subscriptionId = invoiceSubscriptionId(object);
            const paid = eventType === "invoice.paid";
            const periodEnd = toIsoFromSeconds(invoicePeriodEnd(object));
            let accessGrant: any = null;
            if (subscriptionId) {
                const result = await admin
                    .from("student_access_grants")
                    .select("id,student_id,ends_at")
                    .eq("stripe_subscription_id", subscriptionId)
                    .maybeSingle();
                if (result.error) throw result.error;
                accessGrant = result.data;
            }

            if (!accessGrant && eventMetadata.grant_mode === "additive") {
                if (!subscriptionId || !studentId || !planId) {
                    throw new Error("Add-on invoice metadata is incomplete");
                }
                if (paid && !periodEnd) {
                    throw new Error("Paid add-on invoice is missing its period end");
                }
                const { data: addonPlan, error: addonPlanError } = await admin
                    .from("subscription_plans")
                    .select("id,code,access_model")
                    .eq("id", planId)
                    .eq("enabled", true)
                    .maybeSingle();
                if (addonPlanError) throw addonPlanError;
                if (!addonPlan || addonPlan.access_model !== "addon" || !isAiAddonPlanCode(addonPlan.code)) {
                    throw new Error("Invoice plan is not an add-on");
                }
                const startsAt = toIsoFromSeconds(invoicePeriodStart(object)) || new Date().toISOString();
                const { data: createdGrant, error: createGrantError } = await admin
                    .from("student_access_grants")
                    .upsert({
                        student_id: studentId,
                        plan_id: planId,
                        source: "stripe",
                        status: paid ? "active" : "paused",
                        starts_at: startsAt,
                        ends_at: periodEnd,
                        stripe_customer_id: customerId || null,
                        stripe_subscription_id: subscriptionId,
                        stripe_subscription_status: paid ? "active" : "past_due",
                        current_period_end: periodEnd,
                        last_payment_at: paid ? new Date().toISOString() : null,
                        metadata: {
                            plan_code: addonPlan.code,
                            grant_mode: "additive",
                            created_from: eventType
                        },
                        updated_at: new Date().toISOString()
                    }, { onConflict: "stripe_subscription_id" })
                    .select("id,student_id,ends_at")
                    .single();
                if (createGrantError) throw createGrantError;
                accessGrant = createdGrant;
            }

            if (accessGrant) {
                if (paid && !periodEnd) {
                    throw new Error("Paid add-on invoice is missing its period end");
                }
                const grantUpdates: Record<string, unknown> = {
                    status: paid ? "active" : "paused",
                    stripe_customer_id: customerId || null,
                    stripe_subscription_status: paid ? "active" : "past_due",
                    updated_at: new Date().toISOString()
                };
                if (paid) grantUpdates.last_payment_at = new Date().toISOString();
                if (periodEnd) {
                    grantUpdates.current_period_end = periodEnd;
                    grantUpdates.ends_at = periodEnd;
                }
                const { error: grantUpdateError } = await admin
                    .from("student_access_grants")
                    .update(grantUpdates)
                    .eq("id", accessGrant.id);
                if (grantUpdateError) throw grantUpdateError;

                const { data: ownerMembership, error: ownerMembershipError } = await admin
                    .from("memberships")
                    .select("id")
                    .eq("student_id", accessGrant.student_id)
                    .maybeSingle();
                if (ownerMembershipError) throw ownerMembershipError;
                const { error: transactionError } = await admin.from("payment_transactions").upsert({
                    student_id: accessGrant.student_id,
                    membership_id: ownerMembership?.id || null,
                    access_grant_id: accessGrant.id,
                    stripe_event_id: eventId,
                    stripe_invoice_id: cleanText(object.id, 300),
                    stripe_payment_intent_id: invoicePaymentIntentId(object) || null,
                    amount_total: Number.isFinite(Number(object.amount_paid ?? object.amount_due))
                        ? Number(object.amount_paid ?? object.amount_due)
                        : null,
                    currency: cleanText(object.currency, 20) || null,
                    status: paid ? "paid" : "failed",
                    occurred_at: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()
                }, { onConflict: "stripe_invoice_id" });
                if (transactionError) throw transactionError;
            } else {
                let membership: any = null;
                if (customerId) {
                    const result = await admin
                        .from("memberships")
                        .select("id,student_id")
                        .eq("stripe_customer_id", customerId)
                        .maybeSingle();
                    if (result.error) throw result.error;
                    membership = result.data;
                }
                if (!membership && subscriptionId) {
                    const result = await admin
                        .from("memberships")
                        .select("id,student_id")
                        .eq("stripe_subscription_id", subscriptionId)
                        .maybeSingle();
                    if (result.error) throw result.error;
                    membership = result.data;
                }
                if (membership) {
                    const membershipUpdates: Record<string, unknown> = {
                        status: paid ? "active" : "past_due",
                        source: "stripe",
                        updated_at: new Date().toISOString()
                    };
                    if (paid) membershipUpdates.last_payment_at = new Date().toISOString();
                    if (periodEnd) {
                        membershipUpdates.current_period_end = periodEnd;
                        membershipUpdates.access_ends_at = periodEnd;
                    }
                    const { error: updateError } = await admin
                        .from("memberships")
                        .update(membershipUpdates)
                        .eq("id", membership.id);
                    if (updateError) throw updateError;

                    const { error: transactionError } = await admin.from("payment_transactions").upsert({
                        student_id: membership.student_id,
                        membership_id: membership.id,
                        stripe_event_id: eventId,
                        stripe_invoice_id: cleanText(object.id, 300),
                        stripe_payment_intent_id: invoicePaymentIntentId(object) || null,
                        amount_total: Number.isFinite(Number(object.amount_paid ?? object.amount_due))
                            ? Number(object.amount_paid ?? object.amount_due)
                            : null,
                        currency: cleanText(object.currency, 20) || null,
                        status: paid ? "paid" : "failed",
                        occurred_at: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()
                    }, { onConflict: "stripe_invoice_id" });
                    if (transactionError) throw transactionError;
                }
            }
        }

        const { error: processedError } = await admin
            .from("payment_events")
            .update({ status: handled ? "processed" : "ignored", processed_at: new Date().toISOString() })
            .eq("id", eventRecordId);
        if (processedError) throw processedError;
        return json(200, { received: true });
    } catch (error) {
        console.error("Stripe webhook processing failed", error);
        await admin
            .from("payment_events")
            .update({
                status: "failed",
                error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
                processed_at: new Date().toISOString()
            })
            .eq("id", eventRecordId);
        return json(500, { error: "Webhook processing failed" });
    }
});
