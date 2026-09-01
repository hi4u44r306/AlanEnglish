const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

Deno.serve(req => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    return json(410, {
        error: "此舊版學生建立 API 已停用。請使用 academy-student-manager 建立 E1、E3、E5 或 E7 英文班帳號。",
        code: "LEGACY_ACCOUNT_API_DISABLED"
    });
});
