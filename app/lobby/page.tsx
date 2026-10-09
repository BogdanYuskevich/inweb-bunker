"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  professions,
  health,
  skills,
  items,
  phobias,
  secrets,
  perks,
  randomItem,
  randomAge,
} from "../../data/cards";

type Player = {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  is_alive: boolean;
  joined_at: string;
};

type Room = {
  id: string;
  code: string;
  host_name: string;
  status: string;
  starting_players: number | null;
  bunker_capacity: number | null;
  game_round: number | null;
  game_stage: string | null;
  game_phase: string | null;
};

function getBunkerCapacity(playerCount: number) {
  if (playerCount <= 3) return 2;

  if (playerCount === 4) {
    return Math.floor(Math.random() * 2) + 2;
  }

  if (playerCount === 5) {
    return Math.floor(Math.random() * 2) + 2;
  }

  if (playerCount === 6) {
    return Math.floor(Math.random() * 2) + 3;
  }

  if (playerCount === 7) {
    return Math.floor(Math.random() * 3) + 3;
  }

  if (playerCount === 8) {
    return Math.floor(Math.random() * 3) + 4;
  }

  if (playerCount === 9) {
    return Math.floor(Math.random() * 3) + 4;
  }

  if (playerCount === 10) {
    return Math.floor(Math.random() * 4) + 4;
  }

  if (playerCount === 11) {
    return Math.floor(Math.random() * 4) + 5;
  }

  return Math.floor(Math.random() * 4) + 5;
}

export default function LobbyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomCode = searchParams.get("room");
  const playerName = searchParams.get("player");
  const isHost = searchParams.get("host") === "true";

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const participants = useMemo(
    () => players.filter((player) => !player.is_host),
    [players]
  );

  const host = useMemo(
    () => players.find((player) => player.is_host),
    [players]
  );

  async function loadLobby() {
    if (!roomCode) return;

    try {
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode.toUpperCase())
        .single();

      if (roomError || !roomData) {
        setError("Кімнату не знайдено.");
        setLoading(false);
        return;
      }

      setRoom(roomData);

      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomData.id)
        .order("joined_at", { ascending: true });

      if (playersError) {
        throw playersError;
      }

      setPlayers(playersData ?? []);

      if (
        roomData.status === "active" &&
        roomData.game_phase &&
        roomData.game_phase !== "waiting"
      ) {
        router.push(
          `/game?room=${roomData.code}&player=${encodeURIComponent(
            playerName ?? ""
          )}${isHost ? "&host=true" : ""}`
        );
      }
    } catch (err) {
      console.error(err);
      setError("Не вдалося завантажити лобі.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLobby();

    if (!roomCode) return;

    const channelName = `lobby-${roomCode}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
        },
        () => {
          loadLobby();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
        },
        () => {
          loadLobby();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  async function startGame() {
    if (!room || starting) return;

    if (participants.length < 3) {
      setError("Для старту потрібно щонайменше 3 гравці.");
      return;
    }

    setStarting(true);
    setError("");

    try {
      const startingPlayers = participants.length;
      const bunkerCapacity = getBunkerCapacity(startingPlayers);

      // Видаляємо старі персонажі, якщо це повторний запуск гри.
      const { error: deleteCharactersError } = await supabase
        .from("characters")
        .delete()
        .eq("room_id", room.id);

      if (deleteCharactersError) {
        throw deleteCharactersError;
      }

      // Видаляємо старі голоси.
      const { error: deleteVotesError } = await supabase
        .from("votes")
        .delete()
        .eq("room_id", room.id);

      if (deleteVotesError) {
        throw deleteVotesError;
      }

      // Усі гравці знову живі.
      const { error: resetPlayersError } = await supabase
        .from("players")
        .update({
          is_alive: true,
        })
        .eq("room_id", room.id);

      if (resetPlayersError) {
        throw resetPlayersError;
      }

      // Генеруємо персонажа для кожного звичайного гравця.
      const characters = participants.map((player) => ({
        room_id: room.id,
        player_id: player.id,
        age: randomAge(),
        profession: randomItem(professions),
        health: randomItem(health),
        skill: randomItem(skills),
        item: randomItem(items),
        phobia: randomItem(phobias),
        secret: randomItem(secrets),

        // Ось тут створюється perk.
        perk: randomItem(perks),
      }));

      const { error: charactersError } = await supabase
        .from("characters")
        .insert(characters);

      if (charactersError) {
        throw charactersError;
      }

      // Запускаємо гру з briefing.
      const { error: roomUpdateError } = await supabase
        .from("rooms")
        .update({
          status: "active",
          starting_players: startingPlayers,
          bunker_capacity: bunkerCapacity,
          game_round: 1,
          game_stage: "briefing",
          game_phase: "briefing",
          defense_index: 0,
          current_speaker_id: null,
          phase_started_at: new Date().toISOString(),
          round_started_at: null,
          round_ends_at: null,
          current_character: null,
          catastrophe_title: null,
          catastrophe_description: null,
          catastrophe_active: false,
          voting_mode: "normal",
          tied_player_ids: [],
          game_finished_at: null,
          winner_ids: [],
          game_message: "Підготуйтеся до першого раунду.",
          briefing_started_at: new Date().toISOString(),
          discussion_ends_at: null,
        })
        .eq("id", room.id);

      if (roomUpdateError) {
        throw roomUpdateError;
      }

      router.push(
        `/game?room=${room.code}&player=${encodeURIComponent(
          playerName ?? ""
        )}${isHost ? "&host=true" : ""}`
      );
    } catch (err) {
      console.error(err);
      setError(
        "Не вдалося запустити гру. Перевір, чи є колонка perk у characters та чи дозволено видалення персонажів."
      );
      setStarting(false);
    }
  }

  function copyRoomLink() {
    if (!room) return;

    const link = `${window.location.origin}/join?room=${room.code}`;

    navigator.clipboard
      .writeText(link)
      .then(() => {
        setError("Посилання скопійовано.");
        setTimeout(() => setError(""), 2000);
      })
      .catch(() => {
        setError(`Код гри: ${room.code}`);
      });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-red-500">
            INWEB / BUNKER
          </div>
          <div className="mt-4 text-gray-400">Завантажуємо бункер...</div>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-red-500">
            ERROR
          </div>
          <h1 className="mt-4 text-4xl font-black">
            Кімнату не знайдено
          </h1>
          <p className="mt-4 text-gray-400">{error}</p>

          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-red-600 px-6 py-4 font-bold hover:bg-red-500"
          >
            НА ГОЛОВНУ
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* HEADER */}
        <div className="flex flex-col gap-6 border-b border-gray-800 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-red-500">
              INWEB / BUNKER
            </p>

            <h1 className="mt-3 text-5xl font-black tracking-tight md:text-7xl">
              ЛОБІ
            </h1>

            <p className="mt-3 text-gray-400">
              Зберіть команду. Потім відкриємо двері бункера.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 px-6 py-5 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
              Код гри
            </p>

            <div className="mt-1 text-4xl font-black tracking-[0.2em] text-red-500">
              {room.code}
            </div>

            <button
              onClick={copyRoomLink}
              className="mt-3 text-sm text-gray-400 transition hover:text-white"
            >
              Скопіювати посилання
            </button>
          </div>
        </div>

        {/* STATUS */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
            <div className="text-sm text-gray-500">Гравців</div>
            <div className="mt-2 text-3xl font-black">
              {participants.length}
              <span className="ml-2 text-base font-normal text-gray-600">
                / 12
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
            <div className="text-sm text-gray-500">Мінімум для старту</div>
            <div className="mt-2 text-3xl font-black">3</div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
            <div className="text-sm text-gray-500">Статус</div>
            <div className="mt-2 text-2xl font-black text-green-400">
              Очікуємо
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* PLAYERS */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">Учасники</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {participants.length === 0
                    ? "Поки що тут порожньо."
                    : "Усі, хто виживатиме разом з вами."}
                </p>
              </div>
            </div>

            {participants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-950 p-10 text-center">
                <div className="text-5xl">👀</div>
                <p className="mt-4 text-lg font-bold">
                  Чекаємо на перших виживших
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Надішліть колегам код {room.code}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {participants.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-950 p-4"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-lg font-black text-gray-500">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-lg font-bold">
                        {player.name}
                        {player.name === playerName && (
                          <span className="ml-2 text-xs font-normal text-red-500">
                            ТИ
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs uppercase tracking-wider text-green-500">
                        Готовий
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* RIGHT PANEL */}
          <aside className="h-fit rounded-2xl border border-gray-800 bg-gray-950 p-6 lg:sticky lg:top-6">
            {isHost ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-950 text-xl">
                    🎛️
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-red-500">
                      DM
                    </div>
                    <div className="font-bold">{host?.name ?? playerName}</div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/20 p-4">
                  <div className="text-sm font-bold text-red-400">
                    Ти — майстер гри
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    Ти не є гравцем. Твоя задача — керувати раундами,
                    катаклізмами, захистами та голосуванням.
                  </p>
                </div>

                <div className="mt-6">
                  <div className="text-sm text-gray-500">
                    Потенційна місткість бункера
                  </div>

                  <div className="mt-2 text-3xl font-black">
                    ?
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      визначиться на старті
                    </span>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={participants.length < 3 || starting}
                  className="mt-8 w-full rounded-xl bg-red-600 px-6 py-4 text-lg font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {starting ? "ГОТУЄМО БУНКЕР..." : "ПОЧАТИ ГРУ"}
                </button>

                {participants.length < 3 && (
                  <p className="mt-3 text-center text-xs text-gray-600">
                    Потрібно ще{" "}
                    {3 - participants.length}{" "}
                    {3 - participants.length === 1
                      ? "гравця"
                      : "гравців"}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-xl">
                    🧑‍🚀
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
                      Твій статус
                    </div>
                    <div className="font-bold">{playerName}</div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-gray-800 bg-black p-5">
                  <div className="text-2xl">⏳</div>

                  <div className="mt-3 text-lg font-bold">
                    Чекаємо на DM
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    Як тільки майстер гри запустить бункер, ти отримаєш
                    свого персонажа та зможеш ознайомитися з його
                    характеристиками.
                  </p>
                </div>

                <div className="mt-6 text-center">
                  <div className="text-sm text-gray-600">
                    Гравців у кімнаті
                  </div>
                  <div className="mt-1 text-3xl font-black">
                    {participants.length}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div
                className={`mt-4 rounded-xl p-4 text-sm ${
                  error.includes("скопійовано")
                    ? "bg-green-950/40 text-green-400"
                    : "bg-red-950/50 text-red-400"
                }`}
              >
                {error}
              </div>
            )}
          </aside>
        </div>

        {/* RULES */}
        <section className="mt-12 border-t border-gray-800 pt-8">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xl">🎭</div>
              <h3 className="mt-2 font-bold">У кожного свій персонаж</h3>
              <p className="mt-1 text-sm text-gray-500">
                Вік, професія, здоровʼя, навичка, предмет, фобія та
                особлива здібність.
              </p>
            </div>

            <div>
              <div className="text-xl">⏱️</div>
              <h3 className="mt-2 font-bold">Раунди по 5 хвилин</h3>
              <p className="mt-1 text-sm text-gray-500">
                У вас буде час оцінити інших, посперечатися та довести,
                чому саме ви потрібні бункеру.
              </p>
            </div>

            <div>
              <div className="text-xl">☢️</div>
              <h3 className="mt-2 font-bold">Катаклізми</h3>
              <p className="mt-1 text-sm text-gray-500">
                Умови виживання можуть змінитися прямо під час гри.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}