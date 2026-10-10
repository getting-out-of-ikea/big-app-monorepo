'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { login, type LoginState } from './actions';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(login, null);

  return (
    <div className="mx-auto max-w-sm">
      <title>Accedi · VideoApp</title>

      <h1 className="mb-6 text-2xl font-semibold">Accedi</h1>

      {state?.error && (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state?.email ?? ''}
            className="rounded-md"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        Non hai un account?{' '}
        <Link href="/register" className="font-medium underline">
          Registrati
        </Link>
      </p>
    </div>
  );
}
