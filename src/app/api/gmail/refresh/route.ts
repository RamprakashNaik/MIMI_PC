import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    return NextResponse.json({
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date
    });
  } catch (error: any) {
    console.error('Gmail Refresh Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
