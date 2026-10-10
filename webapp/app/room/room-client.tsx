'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';

interface Tile {
  key: string;
  label: string;
  isLocal: boolean;
  isScreenShare: boolean;
  isSpeaking: boolean;
  micMuted: boolean;
  videoTrack: Track | null;
  audioTrack: Track | null;
}

function describeDeviceError(e: unknown): string {
  if (e instanceof DOMException) {
    switch (e.name) {
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'dispositivo non trovato';
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'permesso negato dal browser';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'dispositivo occupato da un’altra applicazione';
      case 'OverconstrainedError':
        return 'vincoli non supportati dal dispositivo';
      case 'SecurityError':
        return 'contesto non sicuro: servono HTTPS o localhost';
      default:
        return e.name;
    }
  }

  return e instanceof Error ? e.message : 'errore sconosciuto';
}

// Restituisce true se il browser rileva almeno una webcam sul sistema
async function hasVideoInput(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === 'videoinput');
  } catch {
    return true;
  }
}

function VideoTrack({
  track,
  muted,
  mirrored,
}: {
  track: Track;
  muted: boolean;
  mirrored: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
    >
      <track kind="captions" />
    </video>
  );
}

function AudioTrack({ track }: { track: Track }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return <audio ref={ref} autoPlay />;
}

export default function RoomClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomName = searchParams.get('room') ?? 'main';

  const roomRef = useRef<Room | null>(null);

  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);

  useEffect(() => {
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    function syncTiles() {
      const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
      const next: Tile[] = [];

      for (const p of all) {
        const publications = [...p.trackPublications.values()];
        const camera = publications.find((t) => t.source === Track.Source.Camera);
        const screen = publications.find((t) => t.source === Track.Source.ScreenShare);
        const mic = publications.find((t) => t.source === Track.Source.Microphone);
        const displayName = p.name || p.identity || 'Ospite';

        next.push({
          key: `${p.identity}-camera`,
          label: p.isLocal ? `${displayName} (tu)` : displayName,
          isLocal: p.isLocal,
          isScreenShare: false,
          isSpeaking: p.isSpeaking,
          micMuted: mic?.isMuted ?? true,
          videoTrack: camera?.track ?? null,
          audioTrack: p.isLocal ? null : (mic?.track ?? null),
        });

        if (screen?.track) {
          next.push({
            key: `${p.identity}-screen`,
            label: `Schermo di ${displayName}`,
            isLocal: p.isLocal,
            isScreenShare: true,
            isSpeaking: false,
            micMuted: false,
            videoTrack: screen.track,
            audioTrack: null,
          });
        }
      }

      setTiles(next);
    }

    async function start() {
      try {
        const res = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}`);

        if (!res.ok) {
          throw new Error(`Impossibile ottenere il token di accesso (errore ${res.status}).`);
        }

        const { token } = (await res.json()) as { token: string };
        const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

        if (!serverUrl) {
          throw new Error(
            'NEXT_PUBLIC_LIVEKIT_URL non configurata: controlla il file webapp/.env.local.'
          );
        }

        if (cancelled) return;

        room
          .on(RoomEvent.TrackSubscribed, syncTiles)
          .on(RoomEvent.TrackUnsubscribed, syncTiles)
          .on(RoomEvent.TrackMuted, syncTiles)
          .on(RoomEvent.TrackUnmuted, syncTiles)
          .on(RoomEvent.ParticipantConnected, syncTiles)
          .on(RoomEvent.ParticipantDisconnected, syncTiles)
          .on(RoomEvent.ActiveSpeakersChanged, syncTiles)
          .on(RoomEvent.LocalTrackPublished, (publication) => {
            if (publication.source === Track.Source.ScreenShare) {
              setSharingScreen(true);
            }
            syncTiles();
          })
          .on(RoomEvent.LocalTrackUnpublished, (publication) => {
            if (publication.source === Track.Source.ScreenShare) {
              setSharingScreen(false);
            }
            syncTiles();
          })
          .on(RoomEvent.Disconnected, () => router.push('/room/ended'));

        await room.connect(serverUrl, token);

        if (cancelled) return;

        // Entriamo comunque nella stanza: camera e microfono si attivano
        // solo se il dispositivo esiste e il browser concede il permesso
        try {
          await room.localParticipant.enableCameraAndMicrophone();
        } catch {
          let micError: string | null = null;
          let camError: string | null = null;

          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch (e) {
            micError = describeDeviceError(e);
            console.warn('Microfono non disponibile:', e);
          }

          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch (e) {
            camError = describeDeviceError(e);
            console.warn('Webcam non disponibile:', e);

            if (!(await hasVideoInput())) {
              camError += ' — il browser non rileva alcuna webcam sul sistema';
            }
          }

          if (micError && camError) {
            setDeviceWarning(
              `Microfono e webcam non disponibili (mic: ${micError}; cam: ${camError}): gli altri partecipanti non ti vedranno né ti sentiranno.`
            );
          } else if (micError) {
            setDeviceWarning(
              `Microfono non disponibile (${micError}): gli altri partecipanti non ti sentiranno.`
            );
          } else if (camError) {
            setDeviceWarning(
              `Webcam non disponibile (${camError}): gli altri partecipanti non ti vedranno.`
            );
          }
        }

        if (cancelled) return;

        setMicEnabled(room.localParticipant.isMicrophoneEnabled);
        setCamEnabled(room.localParticipant.isCameraEnabled);
        setConnected(true);
        syncTiles();
      } catch (e) {
        if (cancelled) return;
        setErrorMessage(e instanceof Error ? e.message : 'Si è verificato un errore imprevisto.');
      }
    }

    void start();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      void room.disconnect();
    };
  }, [roomName, router]);

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.localParticipant.setMicrophoneEnabled(!micEnabled);
    } catch (e) {
      setDeviceWarning(`Microfono non disponibile: ${describeDeviceError(e)}.`);
    }
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
  }

  async function toggleCam() {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.localParticipant.setCameraEnabled(!camEnabled);
    } catch (e) {
      setDeviceWarning(`Webcam non disponibile: ${describeDeviceError(e)}.`);
    }
    setCamEnabled(room.localParticipant.isCameraEnabled);
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.localParticipant.setScreenShareEnabled(!sharingScreen);
    } catch (e) {
      setDeviceWarning(`Condivisione schermo non disponibile: ${describeDeviceError(e)}.`);
    }
  }

  if (errorMessage) {
    return (
      <div className="mx-auto flex h-screen max-w-sm flex-col items-center justify-center gap-4">
        <p className="w-full rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
        <Link href="/" className="text-sm font-medium underline">
          Torna alla home
        </Link>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-gray-600">Connessione alla stanza «{roomName}» in corso…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-sm font-medium">Stanza: {roomName}</h1>
        <span className="text-xs text-gray-400">
          {tiles.filter((t) => !t.isScreenShare).length} partecipanti
        </span>
      </header>

      {deviceWarning && (
        <p className="mx-4 mb-2 rounded-md bg-yellow-500/15 p-3 text-sm text-yellow-300">
          {deviceWarning}
        </p>
      )}

      <main
        className="grid flex-1 gap-3 overflow-y-auto px-4 pb-2"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={`relative aspect-video self-center overflow-hidden rounded-lg bg-gray-900 ${
              tile.isSpeaking ? 'ring-2 ring-green-400' : ''
            }`}
          >
            {tile.videoTrack ? (
              <VideoTrack
                track={tile.videoTrack}
                muted={tile.isLocal}
                mirrored={tile.isLocal && !tile.isScreenShare}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-xl font-semibold">
                  {tile.label.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {tile.audioTrack && <AudioTrack track={tile.audioTrack} />}

            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs">
              {tile.micMuted && !tile.isScreenShare && (
                <span aria-label="microfono disattivato">🔇</span>
              )}
              <span>{tile.label}</span>
            </div>
          </div>
        ))}
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-3 p-4">
        <button
          onClick={toggleMic}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            micEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {micEnabled ? 'Disattiva microfono' : 'Attiva microfono'}
        </button>
        <button
          onClick={toggleCam}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            camEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {camEnabled ? 'Disattiva camera' : 'Attiva camera'}
        </button>
        <button
          onClick={toggleScreenShare}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            sharingScreen ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {sharingScreen ? 'Interrompi condivisione' : 'Condividi schermo'}
        </button>
        <button
          onClick={() => roomRef.current?.disconnect()}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500"
        >
          Esci
        </button>
      </footer>
    </div>
  );
}