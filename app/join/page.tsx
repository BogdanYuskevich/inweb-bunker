"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function JoinGame() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  async function joinGame() {
    if (!name.trim() || !roomCode.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const code = roomCode.trim().toUpperCase();
      const playerName = name.trim();

      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single();

      if (roomError || !room) {
        setError("Кімнату з таким кодом не знайдено.");
        setLoading(false);
        return;
      }

      if (room.status !== "waiting") {
        setError(
          room.status === "active"
            ? "Гра вже розпочалася. Приєднатися більше не можна."
            : "Ця кімната вже закрита."
        );
        setLoading(false);
        return;
      }

      if (
        playerName.toLowerCase() ===
        room.host_name.toLowerCase()
      ) {
        setError(
          "Це ім'я вже використовується Game Master."
        );
        setLoading(false);
        return;
      }

      const { count, error: countError } = await supabase
        .from("players")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("room_id", room.id);

      if (countError) throw countError;

      if ((count ?? 0) >= 12) {
        setError(
          "У цій кімнаті вже максимальна кількість гравців."
        );
        setLoading(false);
        return;
      }

      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id")
        .eq("room_id", room.id)
        .ilike("name", playerName)
        .maybeSingle();

      if (existingPlayer) {
        setError(
          "Гравець з таким ім'ям вже є в кімнаті."
        );
        setLoading(false);
        return;
      }

      const { data: player, error: playerError } =
        await supabase
          .from("players")
          .insert({
            room_id: room.id,
            name: playerName,
            is_host: false,
            is_alive: true,
          })
          .select()
          .single();

      if (playerError) throw playerError;

      router.push(
        `/lobby?room=${room.code}&player=${encodeURIComponent(
          player.name
        )}`
      );
    } catch (error) {
      console.error(error);
      setError(
        "Не вдалося приєднатися до гри. Спробуй ще раз."
      );
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
          Приєднання
        </h1>

        <p className="mt-4 text-gray-400">
          Введи своє ім'я та код кімнати.
        </p>

        <div className="mt-10">
          <label className="mb-2 block text-sm text-gray-400">
            Твоє ім'я
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Наприклад, Андрій"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-5 py-4 text-lg outline-none focus:border-red-500"
          />
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm text-gray-400">
            Код гри
          </label>

          <input
            type="text"
            value={roomCode}
            onChange={(e) =>
              setRoomCode(e.target.value.toUpperCase())
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") joinGame();
            }}
            placeholder="Наприклад, Q7M2K"
            maxLength={5}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-5 py-4 text-lg uppercase tracking-[0.2em] outline-none"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-950/50 p-4 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={joinGame}
          disabled={
            !name.trim() ||
            roomCode.trim().length !== 5 ||
            loading
          }
          className="mt-6 w-full rounded-xl bg-red-600 px-6 py-4 text-lg font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "ПРИЄДНУЄМО..." : "ПРИЄДНАТИСЯ"}
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