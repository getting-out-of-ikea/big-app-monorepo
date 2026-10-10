import { Suspense } from 'react';
import RoomClient from './room-client';

export const metadata = {
  title: 'Videochiamata · VideoApp',
};

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-sm text-gray-600">Caricamento…</p>
        </div>
      }
    >
      <RoomClient />
    </Suspense>
  );
}