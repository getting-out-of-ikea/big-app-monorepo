'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const REDIRECT_SECONDS = 5;

export default function RoomEndedPage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.push('/');
    }
  }, [secondsLeft, router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-white">
      <title>Chiamata conclusa · VideoApp</title>

      <h1 className="text-2xl font-semibold">Chiamata conclusa</h1>
      <p className="text-sm text-gray-400">
        Sarai reindirizzato alla home tra{' '}
        <span className="font-semibold text-white">{Math.max(secondsLeft, 0)}</span>{' '}
        {secondsLeft === 1 ? 'secondo' : 'secondi'}…
      </p>
      <Link href="/" className="text-sm font-medium underline">
        Torna subito alla home
      </Link>
    </div>
  );
}