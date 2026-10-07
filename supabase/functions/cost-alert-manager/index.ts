import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { handleCostAlertRequest } from "../_shared/cost-alert-handler.ts";

Deno.serve(req => handleCostAlertRequest(req, {
    admin: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } }),
    verifyUser: verifyFirebaseRequest, env: name => Deno.env.get(name), fetch
}));
