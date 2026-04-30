import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openUrl as tauriOpen } from '@tauri-apps/plugin-opener';

/**
 * A universal fetch wrapper that uses Tauri's native HTTP plugin when running in a desktop app,
 * and falls back to the internal proxy API when running in a browser.
 */
export async function universalFetch(url: string, options: any = {}) {
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

  if (isTauri) {
    try {
      console.log(`[Tauri Fetch] ${options.method || 'GET'} ${url}`);
      
      const response = await tauriFetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body,
        connectTimeout: 30000,
        signal: options.signal,
      });

      return response;
    } catch (error: any) {
      const errorStr = String(error).toLowerCase();
      if (error.name === 'AbortError' || errorStr.includes('cancel')) {
        throw error; // Re-throw without logging
      }
      console.error('[Tauri Fetch Exception]', error);
      throw error;
    }
  }

  return fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined
    }),
    signal: options.signal
  });
}

/**
 * Opens a URL in the system's default browser.
 */
export async function openLink(url: string) {
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

  if (isTauri) {
    try {
      await tauriOpen(url);
    } catch (error) {
      console.error('[Tauri Open Error]', error);
      // Fallback for dev environment or if plugin fails
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
}

/**
 * Performs a web search using Tavily API.
 */
export async function searchWeb(query: string, apiKey: string) {
  const response = await universalFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: "basic",
      max_results: 5,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Search failed");
  }

  const data = await response.json();
  return data.results.map((r: any) => ({
    title: r.title,
    url: r.url,
    content: r.content
  }));
}
