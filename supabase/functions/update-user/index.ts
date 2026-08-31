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
        error: "此舊版帳號修改 API 已停用。請使用 membership-manager 的 update_account 流程。",
        code: "LEGACY_ACCOUNT_API_DISABLED"
    });
});
