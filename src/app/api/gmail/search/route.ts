import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { accessToken, refreshToken, query, maxResults = 15 } = await req.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxResults,
    });

    const messages = response.data.messages || [];
    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'minimal', // Just get snippets and headers for search
        });
        
        const headers = detail.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;
        
        const subject = getHeader('Subject') || 'No Subject';
        const from = getHeader('From') || 'Unknown Sender';
        const date = getHeader('Date') || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject,
          from,
          date,
          snippet: detail.data.snippet
        };
      })
    );

    return NextResponse.json({ messages: detailedMessages });
  } catch (error: any) {
    console.error('Gmail Search Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
