import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { accessToken, refreshToken, messageId } = await req.json();

    if (!accessToken || !messageId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
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

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    const payload = response.data.payload;
    const headers = payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    // Extract body
    let textBody = "";
    let htmlBody = "";
    
    const extractPart = (part: any) => {
      const mimeType = part.mimeType;
      const data = part.body?.data;
      if (!data) return;
      
      const decoded = Buffer.from(data, 'base64').toString();
      if (mimeType === 'text/plain') textBody = decoded;
      else if (mimeType === 'text/html') htmlBody = decoded;
      
      if (part.parts) {
        part.parts.forEach(extractPart);
      }
    };

    if (payload) {
      extractPart(payload);
    }

    return NextResponse.json({
      id: response.data.id,
      subject,
      from,
      date,
      body: htmlBody || textBody,
      textBody: textBody,
      htmlBody: htmlBody,
      snippet: response.data.snippet,
      isHtml: !!htmlBody
    });
  } catch (error: any) {
    console.error('Gmail Message Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
