import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const X_CLIENT_ID = process.env.X_CLIENT_ID ?? '';
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET ?? '';
const X_CALLBACK_URL =
  process.env.X_CALLBACK_URL ?? 'http://localhost:3001/api/auth';

const X_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_USER_URL = 'https://api.twitter.com/2/users/me';

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// GET - Redirect to X OAuth
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callback = searchParams.get('callback') ?? '/feed';

  if (!X_CLIENT_ID) {
    return NextResponse.json(
      { error: 'X_CLIENT_ID is not configured' },
      { status: 500 },
    );
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state + verifier in a short-lived cookie so we can verify on callback
  const oauthData = JSON.stringify({
    state,
    codeVerifier,
    callback,
  });

  const authUrl = new URL(X_AUTH_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', X_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', X_CALLBACK_URL);
  authUrl.searchParams.set('scope', 'tweet.read users.read offline.access');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());

  // HttpOnly cookie for the OAuth state (5 min expiry)
  response.cookies.set('clawdhq_oauth', oauthData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5 minutes
  });

  return response;
}

// ---------------------------------------------------------------------------
// POST - Exchange code for token
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code: string; state: string };
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 },
      );
    }

    // Read the OAuth state cookie
    const oauthCookie = request.cookies.get('clawdhq_oauth')?.value;
    if (!oauthCookie) {
      return NextResponse.json(
        { error: 'OAuth session expired. Please try again.' },
        { status: 400 },
      );
    }

    const oauthData = JSON.parse(oauthCookie) as {
      state: string;
      codeVerifier: string;
      callback: string;
    };

    // Validate state
    if (state !== oauthData.state) {
      return NextResponse.json(
        { error: 'State mismatch. Possible CSRF attack.' },
        { status: 400 },
      );
    }

    // Exchange code for token
    const tokenResponse = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: X_CALLBACK_URL,
        code_verifier: oauthData.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 502 },
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
    };

    // Fetch user info
    const userResponse = await fetch(
      `${X_USER_URL}?user.fields=profile_image_url`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user information from X' },
        { status: 502 },
      );
    }

    const userData = (await userResponse.json()) as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
      };
    };

    const user = {
      xId: userData.data.id,
      xHandle: userData.data.username,
      xName: userData.data.name,
      xAvatar: userData.data.profile_image_url ?? '',
    };

    // Build the auth payload to store in cookie
    const authPayload = JSON.stringify({
      user,
      token: tokenData.access_token,
    });

    const res = NextResponse.json({
      success: true,
      user,
      callback: oauthData.callback,
    });

    // Set the auth cookie
    res.cookies.set('clawdhq_auth', authPayload, {
      httpOnly: false, // Needs to be readable by client JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Clear the OAuth state cookie
    res.cookies.delete('clawdhq_oauth');

    return res;
  } catch (err) {
    console.error('Auth POST error:', err);
    return NextResponse.json(
      { error: 'Internal server error during authentication' },
      { status: 500 },
    );
  }
}
