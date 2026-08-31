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
        error: "此舊版帳號建立 API 已停用。英文班學生請使用 academy-student-manager；公開註冊請使用 membership-manager。",
        code: "LEGACY_ACCOUNT_API_DISABLED"
    });
});
