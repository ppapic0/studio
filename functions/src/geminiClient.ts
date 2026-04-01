import { studyPlanResponseSchema } from "./plannerSchema";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

async function postJson(url: string, body: unknown) {
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

  return response.json() as Promise<GeminiResponse>;
}

function extractText(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function generateStructuredStudyPlan(params: {
  apiKey: string;
  prompt: string;
  model?: string;
}) {
  const model = params.model || "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`;

  try {
    const structuredResponse = await postJson(endpoint, {
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: studyPlanResponseSchema,
      },
    });
    return extractText(structuredResponse);
  } catch (error) {
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
