import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929082327_prepare_confirmed_test_account_cleanup.sql",
    import.meta.url,
  ),
  "utf8",
);
const purchaseCleanupMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260929083436_fix_test_material_purchase_account_cleanup.sql",
    import.meta.url,
  ),
  "utf8",
);

test("backfills only membership-backed Stripe grants from verified memberships", () => {
  assert.match(migration, /access_grant\.source = 'stripe'/);
  assert.match(migration, /source_reference_type = 'membership'/);
  assert.match(migration, /access_grant\.source_reference_id = membership\.id/);
  assert.match(migration, /membership\.stripe_livemode is not null/);
});

test("sandbox order cleanup is locked to the confirmed opaque account identity", () => {
  assert.match(migration, /v_target_student_id constant bigint := 7/);
  assert.match(migration, /md5\(coalesce\(firebase_uid, ''\)\) = v_expected_uid_digest/);
  assert.match(migration, /stripe_livemode is false/);
  assert.match(migration, /v_order_count <> 2/);
  assert.match(migration, /v_access_grant_count <> 2/);
  assert.match(migration, /v_book_entitlement_count <> 4/);
});

test("does not weaken or replace the reusable account-deletion security functions", () => {
  assert.doesNotMatch(migration, /create\s+or\s+replace\s+function\s+public\.get_student_account_deletion_eligibility/i);
  assert.doesNotMatch(migration, /create\s+or\s+replace\s+function\s+public\.delete_unstarted_student_account/i);
  assert.doesNotMatch(migration, /grant\s+execute/i);
});

test("preserves order audit history while preventing future reclaim", () => {
  assert.match(migration, /insert into public\.store_order_status_history/);
  assert.match(migration, /payment_status = 'refunded'/);
  assert.match(migration, /fulfillment_status = 'cancelled'/);
  assert.match(migration, /claimed_by_student_id = null/);
});

test("blocks live or unknown material purchases before Firebase deletion", () => {
  assert.match(purchaseCleanupMigration, /from public\.material_purchases/);
  assert.match(purchaseCleanupMigration, /stripe_livemode is distinct from false/);
  assert.match(purchaseCleanupMigration, /v_blockers := array_append\(v_blockers, 'payment_or_access_history'\)/);
});

test("removes only explicit test-mode material purchases and their entitlement links", () => {
  assert.match(purchaseCleanupMigration, /target_purchase_entitlements as materialized/);
  assert.match(purchaseCleanupMigration, /delete from public\.material_purchase_entitlements/);
  assert.match(purchaseCleanupMigration, /delete from public\.student_book_entitlements/);
  assert.match(purchaseCleanupMigration, /delete from public\.material_purchases/);
  assert.match(purchaseCleanupMigration, /purchase\.stripe_livemode is false/);
  assert.match(purchaseCleanupMigration, /and stripe_livemode is false/);
});

test("keeps deletion functions service-role only", () => {
  assert.match(purchaseCleanupMigration, /security definer/g);
  assert.match(purchaseCleanupMigration, /set search_path = ''/g);
  assert.match(purchaseCleanupMigration, /revoke all on function public\.get_student_account_deletion_eligibility[\s\S]*from public, anon, authenticated/);
  assert.match(purchaseCleanupMigration, /revoke all on function public\.delete_unstarted_student_account[\s\S]*from public, anon, authenticated/);
  assert.match(purchaseCleanupMigration, /grant execute on function public\.delete_unstarted_student_account[\s\S]*to service_role/);
});
