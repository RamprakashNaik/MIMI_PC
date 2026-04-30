import { universalFetch } from './api';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

/**
 * Refreshes the Gmail access token using the refresh token.
 */
export async function refreshGmailToken(refreshToken: string) {
  try {
    // In a production app, you might want to use a proxy for secrets,
    // but for a local-first desktop app, we use the credentials directly.
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google Client credentials missing in environment.');
    }

    const response = await universalFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString()
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiryDate: Date.now() + (data.expires_in * 1000)
    };
  } catch (error) {
    console.error('Gmail Refresh Error:', error);
    throw error;
  }
}

/**
 * Searches Gmail messages directly from the frontend using Tauri's HTTP plugin.
 */
export async function searchGmail(accessToken: string, query: string, maxResults: number = 15): Promise<GmailMessage[]> {
  try {
    const response = await universalFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

    // Fetch details for each message
    const detailedMessages = await Promise.all(
      messages.map(async (msg: any) => {
        const detailRes = await universalFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=minimal`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!detailRes.ok) return null;
        const detail = await detailRes.json();

        const headers = detail.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value;

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject: getHeader('Subject') || 'No Subject',
          from: getHeader('From') || 'Unknown Sender',
          date: getHeader('Date') || '',
          snippet: detail.snippet || ''
        };
      })
    );

    return detailedMessages.filter((m): m is GmailMessage => m !== null);
  } catch (error) {
    console.error('Gmail Search Error:', error);
    throw error;
  }
}

/**
 * Fetches the full content of a Gmail message.
 */
export async function getGmailMessage(accessToken: string, messageId: string) {
    const response = await universalFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    return response.json();
}
