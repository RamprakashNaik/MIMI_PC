import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { history, provider, modelId } = await req.json();

    if (!history || !provider || !modelId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const systemPrompt = `
You are a "Memory Distiller" agent for MIMI, a personal AI.
Your goal is to read the provided chat history and extract IMPORTANT, PERMANENT facts or preferences about the user or their projects.

RULES:
1. Only extract things that are useful across DIFFERENT conversations.
2. Ignore transient info.
3. Focus on:
   - User Preferences
   - Project Details
   - Facts about the User
   - Repeated Patterns

OUTPUT FORMAT:
You MUST return a JSON object with a "memories" key containing an array of objects:
{
  "memories": [
    { "content": "fact/preference here", "type": "preference|fact|project|pattern", "importance": 1-10 }
  ]
}
`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;

    const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `History:\n${history}` }
        ],
        temperature: 0.1
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `LLM Error: ${errorText}` }, { status: res.status });
    }

    const data = await res.json();
    let memories = [];
    try {
      const content = data.choices[0]?.message?.content;
      // Clean content if model wrapped it in markdown code blocks
      const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      memories = Array.isArray(parsed) ? parsed : (parsed.memories || []);
    } catch (e) {
      console.error("Failed to parse memories from LLM output:", e);
    }

    return NextResponse.json({ memories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
