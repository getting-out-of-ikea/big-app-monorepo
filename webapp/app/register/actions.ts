'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type RegisterState = {
  error?: string;
  email?: string;
  message?: string;
} | null;

export async function register(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const email = formData.get('email')?.toString() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  if (!email || !password) {
    return { error: 'Email e password sono obbligatorie.', email, message: '' };
  }

  if (password.length < 6) {
    return {
      error: 'La password deve contenere almeno 6 caratteri.',
      email,
      message: '',
    };
  }

  const origin = (await headers()).get('origin');
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/login`,
    },
  });

  if (error) {
    return { error: error.message, email, message: '' };
  }

  if (!data.session) {
    return {
      error: '',
      email,
      message: 'Registrazione completata! Controlla la tua email per confermare l’account.',
    };
  }

  redirect('/room');
}
