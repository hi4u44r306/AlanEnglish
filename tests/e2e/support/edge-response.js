const parseRequestBody = request => {
    try {
        return request.postDataJSON();
    } catch {
        return {};
    }
};

const waitForEdgeResponse = (page, functionName, action) => page.waitForResponse(response => {
    if (!response.url().includes(`/functions/v1/${functionName}`)) return false;
    return parseRequestBody(response.request())?.action === action;
}, { timeout: 20_000 });

const readJson = async response => response.json().catch(() => ({}));

module.exports = { readJson, waitForEdgeResponse };
