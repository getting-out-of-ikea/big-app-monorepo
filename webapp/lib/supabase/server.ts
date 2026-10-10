import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // `path` è obbligatorio perché i cookie siano visibili su tutte le rotte
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, { ...options, path: '/' });
            });
          } catch {
            // Chiamato da un Server Component: i cookie non si possono scrivere qui.
            // Non è un problema, perché proxy.ts aggiorna la sessione a ogni richiesta.
          }
        },
      },
    }
  );
}
