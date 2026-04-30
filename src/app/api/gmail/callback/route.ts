import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/gmail/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // We render a simple HTML page that sends the tokens back to the main app window
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authenticating...</title>
          <style>
            body { 
              background: #050505; 
              color: white; 
              font-family: sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.1);
              border-top: 3px solid #6366f1;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              animation: spin 1s linear infinite;
              margin-bottom: 1rem;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <p>Syncing Gmail with MIMI...</p>
          <script>
            const tokens = ${JSON.stringify(tokens)};
            if (window.opener) {
              window.opener.postMessage({ type: 'GMAIL_AUTH_SUCCESS', tokens }, window.location.origin);
              window.close();
            } else {
              // Fallback if not an opener: save to localStorage and redirect
              localStorage.setItem('mimi_gmail_access_token', tokens.access_token);
              if (tokens.refresh_token) localStorage.setItem('mimi_gmail_refresh_token', tokens.refresh_token);
              localStorage.setItem('mimi_gmail_token_expiry', tokens.expiry_date);
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    console.error('Error exchanging code:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
