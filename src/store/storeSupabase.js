import { createClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

// The store deliberately uses its own Supabase Auth session. It does not read,
// replace or synchronize the Firebase session used by the learning platform.
export const storeSupabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storageKey: "ae-store-auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    db: { schema: "public" }
});
