import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rszabtuzsvhaooajnvgc.supabase.co';
const supabaseKey = 'sb_publishable_ka6h_OH9MQC49oSDNJJ8Mg_umgajkLd';

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);