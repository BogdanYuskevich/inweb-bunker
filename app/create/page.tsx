"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return code;
}

export default function CreateGame() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  async function createGame() {
    if (!name.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const hostName = name.trim();
      const roomCode = generateRoomCode();

      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({
          code: roomCode,
          host_name: hostName,
          status: "waiting",
          game_stage: "waiting",
          game_phase: "waiting",
          game_round: 0,
          starting_players: 0,
          bunker_capacity: 2,
          voting_mode: "normal",
          tied_player_ids: [],
        })
        .select()
        .single();

      if (roomError) throw roomError;

      router.push(
        `/lobby?room=${room.code}&host=true&hostName=${encodeURIComponent(
          hostName
        )}`
      );
    } catch (error) {
      console.error(error);
      setError("Не вдалося створити гру. Спробуй ще раз.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-red-500">
          INWEB / BUNKER
        </p>

        <h1 className="text-5xl font-black">
          Створення гри
        </h1>

        <p className="mt-4 text-gray-400">
          Ти будеш Game Master — ведучим гри.
        </p>

        <div className="mt-10">
          <label className="mb-2 block text-sm text-gray-400">
            Ім'я Game Master
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createGame();
            }}
            placeholder="Наприклад, Богдан"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-5 py-4 text-lg outline-none focus:border-red-500"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-950/50 p-4 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={createGame}
          disabled={!name.trim() || loading}
          className="mt-6 w-full rounded-xl bg-red-600 px-6 py-4 text-lg font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "СТВОРЮЄМО..." : "СТВОРИТИ ГРУ"}
        </button>

        <button
          onClick={() => router.push("/")}
          className="mt-4 w-full py-3 text-gray-500 hover:text-white"
        >
          ← Назад
        </button>
      </div>
    </main>
  );
}