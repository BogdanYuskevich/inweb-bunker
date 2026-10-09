import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">
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

        {/* ── ВИБІР РЕЖИМУ ── */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">

          <div className="rounded-3xl border border-red-900 bg-red-950/20 p-6">
            <div className="text-4xl">🛠️</div>

            <h2 className="mt-4 text-2xl font-black">
              RM Бункер
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Корпоративна версія: останній клієнт, Google Ads,
              маркетингові картки й внутрішні пранки.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/create"
                className="flex-1 rounded-xl bg-red-600 px-6 py-4 text-center font-bold transition hover:bg-red-500"
              >
                СТВОРИТИ
              </Link>

              <Link
                href="/join"
                className="flex-1 rounded-xl border border-gray-700 px-6 py-4 text-center font-bold transition hover:border-gray-500 hover:bg-gray-900"
              >
                ПРИЄДНАТИСЯ
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
            <div className="text-4xl">☢️</div>

            <h2 className="mt-4 text-2xl font-black">
              Класичний Бункер
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Канонічна версія: апокаліпсис, виживання, радіація
              й нейтральні картки без корпоративного гумору.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/classic/create"
                className="flex-1 rounded-xl border border-gray-600 px-6 py-4 text-center font-bold transition hover:border-gray-400 hover:bg-gray-900"
              >
                СТВОРИТИ
              </Link>

              <Link
                href="/join"
                className="flex-1 rounded-xl border border-gray-700 px-6 py-4 text-center font-bold transition hover:border-gray-500 hover:bg-gray-900"
              >
                ПРИЄДНАТИСЯ
              </Link>
            </div>
          </div>

        </div>

        <p className="mt-8 text-sm text-gray-600">
          8–12 виживших · 1 бункер · 0 гарантій
        </p>

      </div>
    </main>
  );
}
