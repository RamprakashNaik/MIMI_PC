import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url, method, headers, body } = await req.json();

    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: headers || {},
    };

    if (body) {
      if (typeof body === 'string') {
        fetchOptions.body = body;
      } else {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, fetchOptions);

    // If it's a streaming response
    if (response.headers.get("content-type")?.includes("text/event-stream") || 
        response.headers.get("transfer-encoding") === "chunked" || 
        body?.stream === true) 
    {
        return new Response(response.body, {
            status: response.status,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });
    }

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
