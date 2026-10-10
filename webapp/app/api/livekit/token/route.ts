import { NextResponse, type NextRequest } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Devi effettuare il login per partecipare alla videochiamata.' },
      { status: 401 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Chiavi LiveKit mancanti: controlla .env.local.' },
      { status: 500 }
    );
  }

  const roomName = request.nextUrl.searchParams.get('room') ?? 'main';

  const at = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.email ?? user.id,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await at.toJwt() });
}