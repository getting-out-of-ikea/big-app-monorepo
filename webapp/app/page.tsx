import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="mb-3 text-3xl font-semibold">Videochiamate di gruppo</h1>
      <p className="mb-8 text-gray-600">
        Entra nella stanza per parlare con gli altri partecipanti.
      </p>
      <Link
        href="/room"
        className="inline-block rounded-md bg-gray-900 px-5 py-2.5 text-white hover:bg-gray-700"
      >
        Entra nella stanza
      </Link>
    </div>
  );
}