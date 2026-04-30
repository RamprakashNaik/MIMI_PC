import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { goal, provider, modelId } = await req.json();

    if (!goal || !provider || !modelId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const systemPrompt = `
You are the "Strategic Lead Orchestrator" for MIMI, a high-performance multi-agent team.
Your goal is not just to list tasks, but to strategically route the user's request for maximum accuracy and efficiency.

DYNAMIC ROUTING RULES:
1. ANALYZE complexity: If a request is simple (e.g., "Hi", "How are you?"), use ONLY the "final_answer" tool.
2. CONTEXTUAL MEMORY: If the request implies preferences, past projects, API keys, or recurring tasks, ALWAYS start with a "memory" tool step to recall relevant data from the Memory Vault.
3. TAILOR the team: Do not use the "coder" if there is no technical problem. Do not use "researcher" if the info is likely in memory.
4. CONDITIONAL REVIEW: Only include a "reviewer" step for high-stakes tasks like coding, complex calculations, or deep data analysis.
5. REASONING: For each plan, provide a brief "reasoning" string explaining your strategy.

AGENT ROLES:
- "researcher": Real-time web data & Gmail retrieval.
- "coder": Writing scripts, debugging, and logical architecture.
- "analyst": Data extraction from files, summary, and insight generation.
- "reviewer": High-precision audit of outputs to catch bugs or hallucinations.

AVAILABLE TOOLS:
1. "gmail": Search emails.
2. "search": Web search.
3. "memory": Recall facts.
4. "files": Analyze attachments.
5. **Special Tools**:
   - "planning": Only for the initial architecting step (used by the system).
   - "handoff": Used when one agent (e.g., Researcher) needs to pass consolidated data to another (e.g., Coder).
   - "final_answer": CRITICAL: Use this ONLY for the very last task of the entire plan. It triggers the final user response.

JSON FORMAT (Strict):
{
  "goal": "...",
  "strategy": {
    "agents": ["AgentName1", "AgentName2"],
    "reason": "Brief explanation of strategy.",
    "complexity": "low" | "medium" | "high"
  },
  "tasks": [
    { 
      "id": "t1", 
      "tool": "search" | "gmail" | "files" | "handoff" | "final_answer", 
      "description": "...", 
      "status": "pending", 
      "agentRole": "researcher" | "coder" | "analyst" | "reviewer"
    }
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
