
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-4xl">

        <p className="text-sm uppercase tracking-[0.3em] text-red-500">
          INWEB / CLASSIFIED
        </p>

        <h1 className="mt-6 text-7xl font-black tracking-tight md:text-9xl">
          BUNKER
        </h1>

        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-gray-400 md:text-2xl">
          Клієнт скасував контракт.
          <br />
          Світ закінчується.
          <br />
          Місць у бункері мало.
        </p>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row">

          <Link
            href="/create"
            className="rounded-xl bg-red-600 px-8 py-4 text-center text-lg font-bold transition hover:bg-red-500"
          >
            СТВОРИТИ ГРУ
          </Link>

          <Link
            href="/join"
            className="rounded-xl border border-gray-700 px-8 py-4 text-center text-lg font-bold transition hover:border-gray-500 hover:bg-gray-900"
          >
            ПРИЄДНАТИСЯ
          </Link>

        </div>

        <p className="mt-8 text-sm text-gray-600">
          8–12 виживших · 1 бункер · 0 гарантій
        </p>

      </div>
    </main>
  );
}

