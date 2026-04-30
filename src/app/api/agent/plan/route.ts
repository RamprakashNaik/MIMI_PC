import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { goal, provider, modelId } = await req.json();

    if (!goal || !provider || !modelId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const systemPrompt = `
You are the "Master Orchestrator" for MIMI, a multi-agent AI system.
Your goal is to break down complex user requests into a sequence of actionable tasks assigned to specialist agents.

AGENT ROLES:
- "researcher": Expert at gathering data from Gmail and Web Search.
- "coder": Specialist in writing, debugging, and explaining code.
- "analyst": Focused on processing files, analyzing data, and drawing insights.
- "reviewer": Critical auditor that reviews the final synthesis for accuracy and quality.

AVAILABLE TOOLS:
1. "gmail": Search and read emails.
2. "search": Web search for real-time info.
3. "memory": Recall long-term user facts.
4. "files": Analyze data from uploaded attachments.
5. "final_answer": The final step to synthesize all findings.

RULES:
1. Return a VALID JSON object ONLY.
2. Assign an "agentRole" to each task based on its nature.
3. For complex tasks involving code or data analysis, ALWAYS include a "reviewer" task before the "final_answer".
4. Each task must have: "id", "tool", "description", "status" (pending), and "agentRole".

JSON FORMAT:
{
  "goal": "user goal here",
  "tasks": [
    { "id": "t1", "tool": "search", "description": "...", "status": "pending", "agentRole": "researcher" },
    { "id": "t2", "tool": "final_answer", "description": "...", "status": "pending", "agentRole": "reviewer" }
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
          { role: "user", content: `GOAL: ${goal}` }
        ],
        temperature: 0.1
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Upstream error: ${err}`);
    }

    const data = await res.json();
    const content = data.choices[0]?.message?.content;
    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const plan = JSON.parse(jsonStr);

    return NextResponse.json(plan);
  } catch (err: any) {
    console.error("Planning failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
