import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'VideoApp',
  description: 'Videochiamate di gruppo',
};

async function NavUser() {
  // Dichiara che questo componente dipende dalla richiesta (utente loggato)
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <>
        <span className="text-gray-600">{user.email}</span>
        <form method="POST" action="/logout">
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-100"
          >
            Esci
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="hover:underline">
        Accedi
      </Link>
      <Link
        href="/register"
        className="rounded-md bg-gray-900 px-3 py-1.5 text-white hover:bg-gray-700"
      >
        Registrati
      </Link>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>
        <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
          <header className="border-b border-gray-200 bg-white">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-semibold">
                VideoApp
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <Suspense fallback={null}>
                  <NavUser />
                </Suspense>
              </div>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}