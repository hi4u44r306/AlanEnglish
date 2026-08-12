import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://rszabtuzsvhaooajnvgc.supabase.co";
export const supabaseKey = "sb_publishable_ka6h_OH9MQC49oSDNJJ8Mg_umgajkLd";

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    db: {
        schema: "public"
    }
});