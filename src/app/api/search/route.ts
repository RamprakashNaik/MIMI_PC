import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, apiKey } = await req.json();

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Tavily API key is missing. Add it in Settings." }), { status: 400 });
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_images: false,
        include_answer: false,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(JSON.stringify({ error: errorData.detail || "Tavily search failed" }), { status: response.status });
    }

    const data = await response.json();
    
    // Return a simplified results array
    const results = data.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content
    }));

    return new Response(JSON.stringify({ results }), { status: 200 });

  } catch (error: any) {
    console.error("Search API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
