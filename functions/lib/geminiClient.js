"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStructuredStudyPlan = generateStructuredStudyPlan;
const plannerSchema_1 = require("./plannerSchema");
async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }
    return response.json();
}
function extractText(response) {
    var _a, _b, _c, _d, _e;
    return ((_e = (_d = (_c = (_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "";
}
async function generateStructuredStudyPlan(params) {
    const model = params.model || "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`;
    try {
        const structuredResponse = await postJson(endpoint, {
            contents: [{ role: "user", parts: [{ text: params.prompt }] }],
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: plannerSchema_1.studyPlanResponseSchema,
            },
        });
        return extractText(structuredResponse);
    }
    catch (error) {
        console.warn("[generateStudyPlan] structured schema request failed, falling back", error);
        const fallbackResponse = await postJson(endpoint, {
            contents: [{ role: "user", parts: [{ text: params.prompt }] }],
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
            },
        });
        return extractText(fallbackResponse);
    }
}
//# sourceMappingURL=geminiClient.js.map