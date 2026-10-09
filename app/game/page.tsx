"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type RoomUpdate = {
  game_round?: number;
  game_stage?: string;
  game_phase?: string;
  defense_index?: number;
  current_speaker_id?: string | null;
  catastrophe?: string | null;
  catastrophe_description?: string | null;
  voting_mode?: string;
  tied_player_ids?: string[];
  phase_started_at?: string | null;
  round_started_at?: string | null;
  phase_deadline?: string | null;
  game_paused?: boolean;
  paused_at?: string | null;
  pause_reason?: string | null;
  game_message?: string | null;
  ambience_on?: boolean;
  ambience_track?: string | null;
  status?: string;
  game_finished_at?: string | null;
  winner_ids?: string[];
};

type Room = {
  id: string;
  code: string;
  host_name: string;
  status: string;
  starting_players: number;
  bunker_capacity: number;
  game_round: number | null;
  game_stage: string;
  game_phase: string;
  defense_index: number | null;
  current_speaker_id: string | null;
  catastrophe: string | null;
  catastrophe_description: string | null;
  voting_mode: string;
  tied_player_ids: string[];
  game_finished_at: string | null;
  winner_ids: string[];
  phase_started_at: string | null;
  round_started_at?: string | null;
  phase_deadline?: string | null;
  game_paused?: boolean;
  paused_at?: string | null;
  pause_reason?: string | null;
  game_message?: string | null;
  ambience_on?: boolean;
  ambience_track?: string | null;
};

type Player = {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  is_alive: boolean;
  joined_at: string;
};

type Character = {
  id: string;
  room_id: string;
  player_id: string;
  age: number;
  profession: string;
  health: string;
  skill: string;
  item: string;
  phobia: string;
  secret: string;
  perk: string | null;
};

type PlayerRequest = {
  id: string;
  room_id: string;
  player_id: string;
  round: number | null;
  type: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  dm_reply: string | null;
  created_at: string;
  resolved_at: string | null;
};

const requestTypes = [
  { value: "perk", icon: "⭐", label: "Використати здібність" },
  { value: "question", icon: "🔍", label: "Дізнатись про гравця" },
  { value: "time", icon: "⏱️", label: "Попросити додатковий час" },
  { value: "custom", icon: "🎲", label: "Власна дія" },
];

function requestMeta(type: string) {
  return (
    requestTypes.find((item) => item.value === type) ?? {
      value: type,
      icon: "🎲",
      label: "Запит",
    }
  );
}

type Vote = {
  id: string;
  room_id: string;
  round: number;
  voter_id: string;
  target_id: string;
  created_at: string;
};

const stages = [
  { round: 1, title: "Вік", icon: "🎂", field: "age" as const },
  { round: 2, title: "Професія", icon: "💼", field: "profession" as const },
  { round: 3, title: "Здоров'я", icon: "❤️", field: "health" as const },
  { round: 4, title: "Навичка", icon: "🧠", field: "skill" as const },
  { round: 5, title: "Предмет", icon: "🎒", field: "item" as const },
  { round: 6, title: "Фобія", icon: "😨", field: "phobia" as const },
];

/* Голосування після 3-го, 4-го і 6-го раундів.
 * Перше перенесено з 2-го на 3-й: на 2-му гравці знали лише вік і професію,
 * голосувати було майже нема на чому. На 3-му вже є здоров'я. */
const votingRounds = [3, 4, 6];

const catastrophes = [
  {
    title: "БЮДЖЕТ БУНКЕРУ СКОРОТИЛИ",
    icon: "📉",
    description: "На всіх не вистачає. Ті, хто має найсмішнішу фобію, стають менш цінними для групи.",
  },
  {
    title: "СЕРВЕР АКАУНТА ЗАБЛОКОВАНО",
    icon: "🚫",
    description: "Доступ до бункера обмежено. Люди без навичок виживання тепер офіційно непотрібні.",
  },
  {
    title: "ПРАВКИ ВІД КЛІЄНТА",
    icon: "💬",
    description: "Умови гри змінилися посеред раунду. Кожен має перепояснити свою користь по-новому.",
  },
  {
    title: "ГЕНЕРАТОР НА НУЛІ",
    icon: "⚡",
    description: "Електрики майже не залишилось. Тепер цінні лише ті, хто може працювати без техніки.",
  },
  {
    title: "АУДИТ РЕСУРСІВ",
    icon: "🧾",
    description: "Бункер перевіряє, хто скільки споживає. Ті, хто не приносить користь, отримують попередження.",
  },
  {
    title: "ВИТІК У СУСІДНІЙ БУНКЕР",
    icon: "🔍",
    description: "Про ваш бункер дізнався конкурент. Тепер кожен має довести, що він не слабка ланка.",
  },
  {
    title: "ВТРАТА ЗВ'ЯЗКУ З ЗОВНІШНІМ СВІТОМ",
    icon: "📡",
    description: "Радіо змовкло. Люди без навичок комунікації стають тягарем для групи.",
  },
  {
    title: "ТЕРМІНОВИЙ CALL",
    icon: "📞",
    description: "У вас 30 секунд, щоб вирішити, кого залишити в бункері. Мовчати заборонено.",
  },
  {
    title: "ЗНАЙШЛИ ЧУЖИЙ СЕКРЕТ",
    icon: "🔐",
    description: "Один із секретів став відомий усім. Група більше не довіряє наосліп.",
  },
  {
    title: "ПОТРІБЕН ЛИШЕ ОДИН",
    icon: "🎯",
    description: "Ресурсів вистачає рівно на одну людину. Далі — тільки голосування.",
  },
];

/* ── Готові «втручання» ведучого: DM не вигадує механіку з нуля ── */

const dmPromptIdeas = [
  {
    icon: "🔥",
    label: "Провокаційне питання",
    text: "Провокаційне питання: чому саме ти маєш зайняти місце в бункері, а не той, хто сидить поруч?",
  },
  {
    icon: "🧠",
    label: "Попросити пояснення",
    text: "Поясни без жартів: що ти зробиш у перші 24 години після закриття бункера?",
  },
  {
    icon: "⚔️",
    label: "Зіштовхнути двох гравців",
    text: "Два гравці на вибір: доведіть, чому саме суперник зайвий у бункері.",
  },
  {
    icon: "📢",
    label: "Оголосити всім",
    text: "Увага всім: наступні 30 секунд говорити може лише той, кого ще не слухали.",
  },
  {
    icon: "🎲",
    label: "Випадкова ситуація",
    text: "Випадкова ситуація: у бункері зникло світло. Продовжуйте обговорення навпомацки.",
  },
];

/* ── Готові події: змінюють умови дискусії, не математику гри ── */

const chaosEvents = [
  {
    icon: "📉",
    title: "БЮДЖЕТ БУНКЕРУ СКОРОТИЛИ",
    text: "Запас їжі урізали вдвічі. Ті, хто має найсмішнішу фобію, залишаються без вечері.",
  },
  {
    icon: "🚫",
    title: "БАН ЗА НЕПОЛІТКОРЕКТНЕ",
    text: "Один з вас щойно сказав щось таке, за що весь бункер відключили від Wi-Fi на добу. Хто це був — той виступає без права на помилку.",
  },
  {
    icon: "🏆",
    title: "АУКЦІОН НА НАЙКРАЩИЙ CTR",
    text: "Бункер розподіляє каву за ефективністю. Кожен називає цифру свого CTR. Хто назве найнижчу — пояснює, чому він досі тут.",
  },
  {
    icon: "🔁",
    title: "АВТОМАТИЧНА СТАВКА З'ЇЛА СЕКРЕТ",
    text: "Стратегія викрила один секрет на вибір DM. Той, чий секрет вилізе, має або підтвердити його, або назвати чужий.",
  },
  {
    icon: "💸",
    title: "КЛІЄНТ ПИТАЄ «ЧОМУ ТАК ДОРОГО»",
    text: "Усі мають 15 секунд, щоб виправдати своє існування в бункері. Хто зупиниться — того бункер не бере до уваги.",
  },
  {
    icon: "🛠️",
    title: "АКАУНТ LOW SERVER",
    text: "Ресурсів бункера не вистачає на всіх. Кожен пропонує одну свою характеристику на виключення.",
  },
  {
    icon: "⚙️",
    title: "ПРАВКИ ВІД КЛІЄНТА",
    text: "Умови змінюються: кожен наступний виступ має бути коротшим за попередній. Хто не вклався — вибуває з дискусії.",
  },
  {
    icon: "🧾",
    title: "ТЕНДЕР НА МІСЦЕ",
    text: "Бункер оголошує тендер. Перемагає той, хто наведе найкращий аргумент без слів «досвід» і «комплексно».",
  },
  {
    icon: "📊",
    title: "ЗВІТ ЗА РАУНД",
    text: "Кожен має звітувати за свій попередній виступ. Хто не пояснить, чим був корисний — втрачає право голосу в наступному голосуванні.",
  },
  {
    icon: "⚡",
    title: "ГЕНЕРАТОР ДАЄ ЗБОЇ",
    text: "Електрики вистачає не на всіх. Той, хто не зможе довести свою користь без ноутбука, залишається без нього.",
  },
  {
    icon: "🔍",
    title: "АУДИТ БУНКЕРА",
    text: "DM перевіряє, хто справді робив внесок, а хто лише сидів на зустрічах. Хто мовчав — пояснює, за що його тримати.",
  },
  {
    icon: "🎯",
    title: "ЗМІНА АУДИТОРІЇ",
    text: "Бункер більше не потребує всіх, хто раніше був цінний. Кожен має переконати групу, що саме він — потрібний.",
  },
  {
    icon: "🚨",
    title: "ТЕРМІНОВИЙ CALL ВІД ВЛАСНИКА",
    text: "У вас 30 секунд, щоб вирішити, кого залишити. Мовчати заборонено.",
  },
  {
    icon: "📞",
    title: "ДЗВОНИТЬ КЛІЄНТ, ЯКОГО НЕ БУЛО В ПЛАНІ",
    text: "Клієнт хоче змін негайно. Кожен має за 20 секунд зробити пропозицію, яка не зруйнує решту.",
  },
];

/* ── Правила гри: показуються на брифингу ── */

const rulesIntro = [
  "2047 рік. Світ пережив глобальну катастрофу. Цифровий маркетинг майже зник.",
  "Залишився один добре обладнаний бункер Inweb.",
  "Усередині є електрика, кава, Wi-Fi, Google Ads і один клієнт, який досі пише «доброго вечора, є питання».",
  "Людство не відновиться без трафіку. Тому треба визначити, хто реально потрібен людству — а хто залишиться зовні.",
];

const rulesSteps = [
  { icon: "🎬", title: "6 раундів", text: "Кожен раунд відкриває нову характеристику: вік → професія → здоров'я → навичка → предмет → фобія." },
  { icon: "🎤", title: "Захист", text: "Кожен по черзі доводить свою користь. Ведучий слідкує за часом." },
  { icon: "🗳️", title: "Голосування", text: "Після 2-го, 4-го і 6-го раунду. Більшість — виліт. Нічия — переголосування, якщо й там рівно — вирішує DM." },
  { icon: "🔐", title: "Секрет", text: "У кожного є те, про що він мовчить. Вилізе — і ставлення групи може змінитись." },
  { icon: "📨", title: "Запити", text: "Здібність можна використати один раз і тільки з дозволу DM." },
  { icon: "👑", title: "DM — живий ведучий", text: "Він бачить ваші приховані характеристики й секрети. Сперечатись із ним — марно." },
];

type FlashKind = "round" | "event" | "message";

const flashStyles: Record<FlashKind, { box: string; label: string; icon: string; title: string }> = {
  round: { box: "border-red-500 bg-gradient-to-r from-red-950 via-red-900/60 to-black shadow-[0_0_60px_rgba(239,68,68,0.4)]", label: "🎬 НОВИЙ РАУНД", icon: "🎬", title: "text-red-300" },
  event: { box: "border-yellow-500 bg-gradient-to-r from-yellow-950 via-amber-900/50 to-black shadow-[0_0_60px_rgba(234,179,8,0.4)]", label: "⚡ ПОДІЯ ВІД DM", icon: "⚡", title: "text-yellow-300" },
  message: { box: "border-sky-500 bg-gradient-to-r from-sky-950 via-blue-900/50 to-black shadow-[0_0_60px_rgba(14,165,233,0.4)]", label: "📢 ОГЛОШЕННЯ ВІД DM", icon: "📢", title: "text-sky-300" },
};

/* Анімації гри. Тримаю їх у jsx-global, щоб не чіпати tailwind.config
 * і не залежати від версії Tailwind. */
const gameAnimations = `
  @keyframes bunker-shake {
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-10px) rotate(-0.4deg); }
    30% { transform: translateX(9px) rotate(0.4deg); }
    45% { transform: translateX(-7px); }
    60% { transform: translateX(6px); }
    75% { transform: translateX(-3px); }
    90% { transform: translateX(2px); }
  }
  @keyframes bunker-flash {
    0% { opacity: 0; }
    35% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes bunker-drop {
    0% { opacity: 0; transform: translate(-50%, -140%); }
    70% { opacity: 1; transform: translate(-50%, 8px); }
    100% { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes bunker-rise {
    0% { opacity: 0; transform: translateY(22px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes bunker-glow {
    0%, 100% { box-shadow: 0 0 18px rgba(34, 197, 94, 0.25); }
    50% { box-shadow: 0 0 42px rgba(34, 197, 94, 0.55); }
  }
  .anim-shake { animation: bunker-shake 0.65s ease-in-out; }
  .anim-flash { animation: bunker-flash 1s ease-out; }
  .anim-drop { animation: bunker-drop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4); }
  .anim-rise { animation: bunker-rise 0.5s ease-out both; }
  .anim-glow { animation: bunker-glow 2s ease-in-out infinite; }
`;

/* ── Звуки ──
 * Синтез через Web Audio API: не тягнемо жодного mp3, усе генерується
 * на льоту. Браузер дозволяє звук лише після першої взаємодії — тому
 * функція тихо виходить, якщо контекст ще заблокований. */

type SoundName =
  | "round"
  | "event"
  | "message"
  | "eliminate"
  | "vote"
  | "tick"
  | "final"
  | "click"
  | "confirm"
  | "deny"
  | "voting"
  | "defense"
  | "speaker"
  | "urgent"
  | "timeout";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!Ctor) return null;

  if (!audioCtx) {
    audioCtx = new Ctor();
  }

  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }

  return audioCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

  vol.gain.setValueAtTime(0, ctx.currentTime + start);
  vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  vol.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + start + duration
  );

  osc.connect(vol);
  vol.connect(ctx.destination);

  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

function playSound(name: SoundName) {
  const ctx = getAudioContext();
  if (!ctx) return;

  switch (name) {
    case "round":
      tone(ctx, 523.25, 0, 0.35, 0.16, "triangle");
      tone(ctx, 659.25, 0.12, 0.35, 0.14, "triangle");
      tone(ctx, 783.99, 0.24, 0.5, 0.12, "triangle");
      break;

    case "event":
      tone(ctx, 180, 0, 0.5, 0.2, "sawtooth");
      tone(ctx, 140, 0.18, 0.6, 0.16, "sawtooth");
      break;

    case "message":
      tone(ctx, 880, 0, 0.15, 0.12, "sine");
      tone(ctx, 1174.66, 0.12, 0.25, 0.1, "sine");
      break;

    case "eliminate":
      tone(ctx, 300, 0, 0.6, 0.22, "square");
      tone(ctx, 200, 0.15, 0.7, 0.18, "square");
      tone(ctx, 110, 0.32, 1, 0.16, "square");
      break;

    case "vote":
      tone(ctx, 660, 0, 0.08, 0.1, "sine");
      break;

    case "tick":
      tone(ctx, 1200, 0, 0.05, 0.07, "square");
      break;

    /* Клік по кнопці — короткий м'який стук. */
    case "click":
      tone(ctx, 520, 0, 0.06, 0.08, "triangle");
      break;

    /* Голос віддано — підтвердження. */
    case "confirm":
      tone(ctx, 700, 0, 0.09, 0.1, "sine");
      tone(ctx, 1050, 0.07, 0.14, 0.08, "sine");
      break;

    /* Помилка / відмова — низький короткий. */
    case "deny":
      tone(ctx, 220, 0, 0.18, 0.12, "square");
      break;

    /* Почався захист — низький вступний тон. */
    case "defense":
      tone(ctx, 196, 0, 0.5, 0.14, "sine");
      tone(ctx, 293.66, 0.2, 0.6, 0.12, "sine");
      break;

    /* Передали слово іншому — короткий «свуш». */
    case "speaker":
      tone(ctx, 620, 0, 0.07, 0.09, "triangle");
      tone(ctx, 880, 0.05, 0.11, 0.07, "triangle");
      break;

    /* Останні секунди виступу — напружене цокання. */
    case "urgent":
      tone(ctx, 880, 0, 0.07, 0.12, "square");
      break;

    /* Час вийшов. */
    case "timeout":
      tone(ctx, 330, 0, 0.3, 0.16, "sawtooth");
      tone(ctx, 220, 0.22, 0.5, 0.14, "sawtooth");
      break;

    /* Голосування триває — пульсуючий сигнал. */
    case "voting":
      tone(ctx, 440, 0, 0.12, 0.09, "triangle");
      tone(ctx, 440, 0.28, 0.12, 0.07, "triangle");
      break;

    case "final":
      tone(ctx, 523.25, 0, 0.3, 0.15, "triangle");
      tone(ctx, 659.25, 0.16, 0.3, 0.15, "triangle");
      tone(ctx, 783.99, 0.32, 0.3, 0.15, "triangle");
      tone(ctx, 1046.5, 0.48, 0.8, 0.18, "triangle");
      break;
  }
}

/* ── Амбієнт бункера ──
 * Низький дрон плюс фільтрований шум: вентиляція, лампи, гул під землею.
 * Усе синтезується, жодного аудіофайлу. */

/* ── Треки фонового гулу ──
 * DM перемикає їх усім гравцям. Кожен трек — свої параметри синтезу. */

type AmbienceTrack = "bunker" | "tension" | "generator" | "silence";

const ambienceTracks: {
  value: AmbienceTrack;
  icon: string;
  label: string;
  hint: string;
}[] = [
  {
    value: "bunker",
    icon: "🛖",
    label: "Бункер",
    hint: "Базовий гул: вентиляція, лампи, тиша під землею",
  },
  {
    value: "tension",
    icon: "⚠️",
    label: "Напруга",
    hint: "Під час голосування: вищий тон, щільніший шум",
  },
  {
    value: "generator",
    icon: "⚙️",
    label: "Генератор",
    hint: "Гуркіт двигуна й металевий дзвін",
  },
  {
    value: "silence",
    icon: "🔇",
    label: "Тиша",
    hint: "Вимкнути фон повністю",
  },
];

let ambienceNodes: {
  master: GainNode;
  drone: OscillatorNode;
  drone2: OscillatorNode;
  noise: AudioBufferSourceNode;
  filter: BiquadFilterNode;
} | null = null;

function startAmbience(track: AmbienceTrack = "bunker") {
  const ctx = getAudioContext();
  if (!ctx || ambienceNodes) return;

  /* Параметри залежать від треку. */
  const preset =
    track === "tension"
      ? { masterGain: 0.075, drone: 65, drone2: 98, filter: 620, noise: 0.5 }
      : track === "generator"
      ? { masterGain: 0.085, drone: 42, drone2: 63, filter: 300, noise: 0.75 }
      : { masterGain: 0.055, drone: 52, drone2: 78.5, filter: 420, noise: 0.4 };

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(preset.masterGain, ctx.currentTime + 4);

  /* Дрон: дві низькі ноти з детюном, щоб було «живе» гудіння. */
  const drone = ctx.createOscillator();
  drone.type = "sine";
  drone.frequency.setValueAtTime(preset.drone, ctx.currentTime);

  const drone2 = ctx.createOscillator();
  drone2.type = "triangle";
  drone2.frequency.setValueAtTime(preset.drone2, ctx.currentTime);
  drone2.detune.setValueAtTime(7, ctx.currentTime);

  /* Шум: вентиляція. */
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.35;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(preset.filter, ctx.currentTime);
  filter.Q.setValueAtTime(0.7, ctx.currentTime);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(preset.noise, ctx.currentTime);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);

  drone.connect(master);
  drone2.connect(master);
  master.connect(ctx.destination);

  drone.start();
  drone2.start();
  noise.start();

  ambienceNodes = { master, drone, drone2, noise, filter };
}

function stopAmbience() {
  const ctx = getAudioContext();
  if (!ctx || !ambienceNodes) return;

  const nodes = ambienceNodes;
  ambienceNodes = null;

  nodes.master.gain.cancelScheduledValues(ctx.currentTime);
  nodes.master.gain.setValueAtTime(nodes.master.gain.value, ctx.currentTime);
  nodes.master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

  setTimeout(() => {
    try {
      nodes.drone.stop();
      nodes.drone2.stop();
      nodes.noise.stop();
    } catch {
      /* вузли вже зупинені — нічого робити */
    }
  }, 1400);
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

type CharacterField = (typeof stages)[number]["field"];

function characterValue(character: Character, field: CharacterField) {
  if (field === "age") return `${character.age} років`;
  return character[field];
}

export default function GamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomCode = searchParams.get("room");
  const playerName = searchParams.get("player");
  const hostFromUrl = searchParams.get("host") === "true";

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(120);

  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedCatastrophe, setSelectedCatastrophe] = useState(0);

  const [actionLoading, setActionLoading] = useState(false);

  // ── DM-пульт ──
  const [dmMessage, setDmMessage] = useState("");

  // ── Запити гравців до DM ──
  const [requests, setRequests] = useState<PlayerRequest[]>([]);
  const [requestType, setRequestType] = useState("perk");
  const [requestText, setRequestText] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // ── Правила + флеш-анонси змін від DM ──
  const [showRules, setShowRules] = useState(false);
  const [secretHidden, setSecretHidden] = useState(false);
  const [dismissedRules, setDismissedRules] = useState(false);
  const [flash, setFlash] = useState<{
    kind: FlashKind;
    round: number;
    title: string;
    text: string | null;
    stamp: number;
  } | null>(null);
  const lastSeenRef = useRef<{
    round: number;
    catastrophe: string | null;
    message: string | null;
    aliveCount: number;
    phase: string;
    speakerId: string | null;
  } | null>(null);
  const [interventionOpen, setInterventionOpen] = useState(false);
  /* Активна вкладка пульта: DM бачить один розділ за раз,
   * тому пульт не перетворюється на тисячу рядків прокрутки. */
  const [dmTab, setDmTab] = useState<"scene" | "sound" | "requests" | "chaos">(
    "scene"
  );

  const [openBlock, setOpenBlock] = useState<string>("scene");
  const [shakeKey, setShakeKey] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  /* Локальний вимикач гравця: гул приходить від DM, але кожен може
   * вимкнути його собі. */
  const [ambienceMuted, setAmbienceMuted] = useState(false);

  /* Ключ тряски та спалах раунду мусять бути оголошені ДО першого
   * використання в JSX — інакше TS свариться на order-of-declaration. */
  const shakeClass = shakeKey > 0 ? "anim-shake" : "";

  const roundFlash =
    flash && flash.kind === "round" ? (
      <div
        key={`round-flash-${flashKey}`}
        className="anim-flash pointer-events-none fixed inset-0 z-40 bg-gradient-to-b from-red-600/45 via-red-900/20 to-transparent"
      />
    ) : null;
  const [chaosOpen, setChaosOpen] = useState(false);
  const [revealAllOpen, setRevealAllOpen] = useState(false);
  const [charactersExpanded, setCharactersExpanded] = useState(false);

  const isHost = hostFromUrl;

  const alivePlayers = useMemo(
    () => players.filter((player) => player.is_alive),
    [players]
  );

  const currentRound = room?.game_round ?? 0;

  const currentStage = useMemo(() => {
    if (!currentRound) return null;

    return stages.find((stage) => stage.round === currentRound) ?? null;
  }, [currentRound]);

  const currentSpeaker = useMemo(() => {
    if (!room) return null;

    if (room.current_speaker_id) {
      return (
        alivePlayers.find((player) => player.id === room.current_speaker_id) ??
        null
      );
    }

    return alivePlayers[room.defense_index ?? 0] ?? null;
  }, [room, alivePlayers]);

  const tiedPlayerIds = useMemo(
    () => parseJsonArray(room?.tied_player_ids),
    [room?.tied_player_ids]
  );

  const isTiebreak =
    room?.voting_mode === "tiebreak" || room?.game_stage === "tiebreak";

  const isManualElimination = room?.game_stage === "manual_elimination";

  const isPaused = Boolean(room?.game_paused);

  const phaseLabel = useMemo(() => {
    if (room?.game_phase === "defense") return "ЗАХИСТ";
    if (room?.game_phase === "voting") return "ГОЛОСУВАННЯ";
    if (room?.game_phase === "results") return "РЕЗУЛЬТАТИ";
    if (room?.game_phase === "reveal") return "РОЗКРИТТЯ";
    if (room?.game_phase === "briefing") return "БРИФІНГ";
    if (room?.game_phase === "final") return "ФІНАЛ";
    return "ОЧІКУВАННЯ";
  }, [room?.game_phase]);

  const isFreshRound =
    Boolean(room?.round_started_at) &&
    currentRound >= 1 &&
    currentRound <= 6;

  const votingTargets = useMemo(() => {
    if (!currentPlayer) return [];

    if (isTiebreak) {
      return alivePlayers.filter((player) => tiedPlayerIds.includes(player.id));
    }

    return alivePlayers.filter((player) => player.id !== currentPlayer.id);
  }, [currentPlayer, alivePlayers, isTiebreak, tiedPlayerIds]);

  const canVote = useMemo(() => {
    if (!currentPlayer?.is_alive) return false;

    if (isTiebreak && tiedPlayerIds.includes(currentPlayer.id)) return false;

    return true;
  }, [currentPlayer, isTiebreak, tiedPlayerIds]);

  async function loadGame() {
    if (!roomCode) return;

    try {
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode.toUpperCase())
        .single();

      if (roomError || !roomData) {
        router.push("/join");
        return;
      }

      const normalizedRoom: Room = {
        ...roomData,
        tied_player_ids: parseJsonArray(roomData.tied_player_ids),
        winner_ids: parseJsonArray(roomData.winner_ids),
      };

      setRoom(normalizedRoom);

      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomData.id)
        .order("joined_at", { ascending: true });

      const loadedPlayers = playerData ?? [];

      setPlayers(loadedPlayers);

      if (!isHost && playerName) {
        const me =
          loadedPlayers.find((player) => player.name === playerName) ?? null;

        setCurrentPlayer(me);
      }

      const { data: characterData } = await supabase
        .from("characters")
        .select("*")
        .eq("room_id", roomData.id);

      setCharacters(characterData ?? []);

      const { data: requestData } = await supabase
        .from("player_requests")
        .select("*")
        .eq("room_id", roomData.id)
        .order("created_at", { ascending: false });

      setRequests(requestData ?? []);

      if (roomData.game_phase === "voting" || roomData.game_phase === "results") {
        const { data: voteData } = await supabase
          .from("votes")
          .select("*")
          .eq("room_id", roomData.id)
          .eq("round", roomData.game_round ?? 0);

        setVotes(voteData ?? []);
      } else {
        setVotes([]);
      }

      if (roomData.status === "waiting" && !roomData.game_finished_at) {
        if (isHost) {
          router.push(
            `/lobby?room=${roomData.code}&host=true&hostName=${encodeURIComponent(
              roomData.host_name
            )}`
          );
        } else {
          router.push(
            `/lobby?room=${roomData.code}&player=${encodeURIComponent(
              playerName ?? ""
            )}`
          );
        }

        return;
      }
    } catch (error) {
      console.error("loadGame error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateRoom(updates: RoomUpdate) {
    if (!room) return false;

    const { data, error } = await supabase
      .from("rooms")
      .update(updates)
      .eq("id", room.id)
      .select()
      .single();

    if (error) {
      const detail = [error.message, error.details, error.hint, error.code]
        .filter(Boolean)
        .join(" | ");

      console.error("updateRoom error:", detail || error);

      /* Найчастіша причина на старті — забута міграція.
       * Підказуємо прямо, щоб не шукати наосліп. */
      const isMissingColumn =
        error.code === "42703" ||
        /column .* does not exist/i.test(error.message ?? "");

      alert(
        isMissingColumn
          ? "Не вдалося оновити кімнату: у базі немає потрібної колонки.\n\n" +
              "Виконай SQL-міграцію:\n" +
              "alter table public.rooms add column if not exists ambience_on boolean not null default false;\n" +
              "alter table public.rooms add column if not exists ambience_track text default 'bunker';\n\n" +
              `Деталі: ${detail}`
          : `Не вдалося оновити кімнату.\n\n${detail || "Причина невідома"}`
      );

      return false;
    }

    const normalizedRoom: Room = {
      ...data,
      tied_player_ids: parseJsonArray(data.tied_player_ids),
      winner_ids: parseJsonArray(data.winner_ids),
    };

    setRoom(normalizedRoom);

    return true;
  }

  /* ── Хелпери нового стану (round announcements + пауза) ── */

  function roundPatch(
    round: number,
    phase: string,
    stage: string,
    extra: RoomUpdate = {}
  ): RoomUpdate {
    const now = new Date();
    const deadline = new Date(now.getTime() + 120 * 1000);

    return {
      game_round: round,
      game_phase: phase,
      game_stage: stage,
      phase_started_at: now.toISOString(),
      round_started_at: now.toISOString(),
      phase_deadline: phase === "defense" ? deadline.toISOString() : null,
      game_paused: false,
      paused_at: null,
      ...extra,
    };
  }

  async function startGame() {
    if (!room || !isHost || actionLoading || room.game_phase !== "briefing") {
      return;
    }

    setActionLoading(true);

    try {
      await updateRoom(
        roundPatch(1, "reveal", "reveal", {
          defense_index: 0,
          current_speaker_id: null,
          voting_mode: "normal",
          tied_player_ids: [],
          catastrophe: null,
          catastrophe_description: null,
        })
      );

      await loadGame();
    } finally {
      setActionLoading(false);
    }
  }

  async function startNextReveal() {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      const nextRound = currentRound + 1;

      if (nextRound > 6) {
        await startDefense();
        return;
      }

      await updateRoom(
        roundPatch(nextRound, "reveal", "reveal", {
          defense_index: 0,
          current_speaker_id: null,
        })
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function startDefense() {
    if (!room || !isHost || actionLoading) return;

    if (alivePlayers.length === 0) {
      alert("Немає живих гравців — захист неможливий.");
      return;
    }

    setActionLoading(true);

    try {
      const firstSpeaker = alivePlayers[0];
      const now = new Date();
      const deadline = new Date(now.getTime() + 120 * 1000);

      await updateRoom({
        game_phase: "defense",
        game_stage: "defense",
        defense_index: 0,
        current_speaker_id: firstSpeaker?.id ?? null,
        phase_started_at: now.toISOString(),
        phase_deadline: deadline.toISOString(),
        game_paused: false,
        paused_at: null,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function nextSpeaker() {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      const currentIndex = alivePlayers.findIndex(
        (player) => player.id === room.current_speaker_id
      );

      const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;

      if (nextIndex >= alivePlayers.length) {
        await startVotingInternal();
        return;
      }

      const nextPlayer = alivePlayers[nextIndex];
      const now = new Date();
      const deadline = new Date(now.getTime() + 120 * 1000);

      await updateRoom({
        defense_index: nextIndex,
        current_speaker_id: nextPlayer.id,
        phase_started_at: now.toISOString(),
        phase_deadline: deadline.toISOString(),
        game_paused: false,
        paused_at: null,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function startVotingInternal() {
    if (!room) return;

    setSelectedTarget("");

    await supabase
      .from("votes")
      .delete()
      .eq("room_id", room.id)
      .eq("round", currentRound);

    await updateRoom({
      game_phase: "voting",
      game_stage: "voting",
      voting_mode: "normal",
      tied_player_ids: [],
      phase_started_at: new Date().toISOString(),
      phase_deadline: null,
      game_paused: false,
      paused_at: null,
    });
  }

  async function startVoting() {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      await startVotingInternal();
    } finally {
      setActionLoading(false);
    }
  }

  async function submitVote(targetId: string) {
    if (!room || !currentPlayer || !currentPlayer.is_alive) return;

    if (!canVote) {
      alert("Ти не можеш голосувати в цьому голосуванні.");
      return;
    }

    if (targetId === currentPlayer.id) {
      alert("За себе голосувати не можна.");
      return;
    }

    if (isTiebreak && !tiedPlayerIds.includes(targetId)) {
      alert("У переголосуванні можна голосувати тільки за кандидатів.");
      return;
    }

    setActionLoading(true);

    try {
      const { error } = await supabase.from("votes").upsert(
        {
          room_id: room.id,
          round: currentRound,
          voter_id: currentPlayer.id,
          target_id: targetId,
        },
        { onConflict: "room_id,round,voter_id" }
      );

      if (error) {
        console.error("submitVote error:", error);
        alert("Не вдалося віддати голос.");
        return;
      }

      setSelectedTarget(targetId);

      if (soundOn) playSound("confirm");

      await loadGame();
    } finally {
      setActionLoading(false);
    }
  }

  function getVoteResults() {
    const counts: Record<string, number> = {};

    alivePlayers.forEach((player) => {
      counts[player.id] = 0;
    });

    votes.forEach((vote) => {
      const voter = players.find((player) => player.id === vote.voter_id);
      const target = players.find((player) => player.id === vote.target_id);

      if (!voter?.is_alive) return;
      if (!target?.is_alive) return;

      if (isTiebreak && tiedPlayerIds.includes(voter.id)) return;
      if (isTiebreak && !tiedPlayerIds.includes(target.id)) return;

      counts[vote.target_id] = (counts[vote.target_id] || 0) + 1;
    });

    const values = Object.values(counts);

    if (!values.length) {
      return { counts, maxVotes: 0, leaders: [] as string[] };
    }

    const maxVotes = Math.max(...values);

    const leaders = Object.entries(counts)
      .filter(([, count]) => count === maxVotes)
      .map(([id]) => id);

    return { counts, maxVotes, leaders };
  }

  async function showResults() {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      await updateRoom({
        game_phase: "results",
        game_stage: isTiebreak ? "tiebreak_results" : "results",
      });

      await loadGame();
    } finally {
      setActionLoading(false);
    }
  }

  async function processResults() {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      const { data: latestVotes } = await supabase
        .from("votes")
        .select("*")
        .eq("room_id", room.id)
        .eq("round", currentRound);

      const actualVotes = latestVotes ?? [];

      const freshAlivePlayers = players.filter((player) => player.is_alive);

      const counts: Record<string, number> = {};

      freshAlivePlayers.forEach((player) => {
        counts[player.id] = 0;
      });

      actualVotes.forEach((vote) => {
        const voter = players.find((player) => player.id === vote.voter_id);
        const target = players.find((player) => player.id === vote.target_id);

        if (!voter?.is_alive) return;
        if (!target?.is_alive) return;

        if (isTiebreak && tiedPlayerIds.includes(voter.id)) return;
        if (isTiebreak && !tiedPlayerIds.includes(target.id)) return;

        counts[vote.target_id] = (counts[vote.target_id] || 0) + 1;
      });

      const values = Object.values(counts);

      if (!values.length) {
        alert("Немає доступних голосів.");
        return;
      }

      const maxVotes = Math.max(...values);

      const leaders = Object.entries(counts)
        .filter(([, count]) => count === maxVotes)
        .map(([id]) => id);

      if (leaders.length > 1) {
        const safePlayers = freshAlivePlayers.filter(
          (player) => !leaders.includes(player.id)
        );

        if (isTiebreak) {
          await updateRoom({
            game_phase: "results",
            game_stage: "manual_elimination",
            tied_player_ids: leaders,
          });

          await loadGame();
          return;
        }

        if (safePlayers.length < 2) {
          await updateRoom({
            game_phase: "results",
            game_stage: "manual_elimination",
            tied_player_ids: leaders,
          });

          await loadGame();
          return;
        }

        await supabase
          .from("votes")
          .delete()
          .eq("room_id", room.id)
          .eq("round", currentRound);

        setSelectedTarget("");

        await updateRoom({
          game_phase: "voting",
          game_stage: "tiebreak",
          voting_mode: "tiebreak",
          tied_player_ids: leaders,
          phase_started_at: new Date().toISOString(),
        });

        await loadGame();
        return;
      }

      const eliminatedId = leaders[0];

      if (!eliminatedId) {
        alert("Не вдалося визначити гравця.");
        return;
      }

      await eliminatePlayer(eliminatedId);
    } finally {
      setActionLoading(false);
    }
  }

  async function eliminatePlayer(playerId: string) {
    if (!room || !isHost) return;

    const player = players.find((item) => item.id === playerId);

    if (!player || !player.is_alive) return;

    const { error } = await supabase
      .from("players")
      .update({ is_alive: false })
      .eq("id", playerId);

    if (error) {
      console.error("eliminatePlayer error:", error);
      alert("Не вдалося вилучити гравця.");
      return;
    }

    const remainingPlayers = players.filter(
      (item) => item.is_alive && item.id !== playerId
    );

    if (remainingPlayers.length <= room.bunker_capacity) {
      const winnerIds = remainingPlayers.map((player) => player.id);

      await updateRoom({
        status: "closed",
        game_phase: "final",
        game_stage: "final",
        game_finished_at: new Date().toISOString(),
        winner_ids: winnerIds,
        voting_mode: "normal",
        tied_player_ids: [],
        phase_deadline: null,
        game_paused: false,
        paused_at: null,
      });

      await loadGame();
      return;
    }

    if (currentRound >= 6 && remainingPlayers.length <= room.bunker_capacity) {
      const winnerIds = remainingPlayers.map((player) => player.id);

      await updateRoom({
        status: "closed",
        game_phase: "final",
        game_stage: "final",
        game_finished_at: new Date().toISOString(),
        winner_ids: winnerIds,
        voting_mode: "normal",
        tied_player_ids: [],
        phase_deadline: null,
        game_paused: false,
        paused_at: null,
      });

      await loadGame();
      return;
    }

    await updateRoom(
      roundPatch(currentRound + 1, "reveal", "reveal", {
        defense_index: 0,
        current_speaker_id: null,
        voting_mode: "normal",
        tied_player_ids: [],
        catastrophe: null,
        catastrophe_description: null,
      })
    );

    await loadGame();
  }

  async function hostEliminate(playerId: string) {
    if (!isHost || actionLoading) return;

    const player = players.find((item) => item.id === playerId);

    if (!player || !player.is_alive) return;

    const confirmed = window.confirm(`Вилучити ${player.name} з гри?`);

    if (!confirmed) return;

    setActionLoading(true);

    try {
      await eliminatePlayer(playerId);
    } finally {
      setActionLoading(false);
    }
  }

  /* ── 📨 ЗАПИТИ ГРАВЦІВ ── */

  async function submitRequest() {
    if (!room || !currentPlayer || !currentPlayer.is_alive) return;

    const text = requestText.trim();

    if (!text) {
      alert("Напиши, що саме хочеш зробити.");
      return;
    }

    const hasPending = requests.some(
      (item) => item.player_id === currentPlayer.id && item.status === "pending"
    );

    if (hasPending) {
      alert("У тебе вже є запит, який чекає на рішення DM.");
      return;
    }

    setActionLoading(true);

    try {
      const { error } = await supabase.from("player_requests").insert({
        room_id: room.id,
        player_id: currentPlayer.id,
        round: currentRound,
        type: requestType,
        message: text,
        status: "pending",
      });

      if (error) {
        const detail = [
          error.message,
          error.details,
          error.hint,
          error.code,
        ]
          .filter(Boolean)
          .join(" | ");

        console.error("submitRequest error:", detail || error);
        alert(`Не вдалося надіслати запит.\n\n${detail || "Причина невідома"}`);
        return;
      }

      setRequestText("");
      await loadGame();
    } finally {
      setActionLoading(false);
    }
  }

  async function resolveRequest(
    request: PlayerRequest,
    status: "approved" | "rejected",
    announce = false
  ) {
    if (!room || !isHost || actionLoading) return;

    const reply = (replyDrafts[request.id] ?? "").trim();

    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("player_requests")
        .update({
          status,
          dm_reply: reply || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) {
        console.error("resolveRequest error:", error);
        alert("Не вдалося оновити запит.");
        return;
      }

      if (announce) {
        const author =
          players.find((item) => item.id === request.player_id)?.name ?? "Гравець";

        await updateRoom({
          game_message: `📢 ${author}: ${request.message}${reply ? ` — DM: ${reply}` : ""}`,
        });
      }

      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });

      await loadGame();
    } finally {
      setActionLoading(false);
    }
  }

  /* ── ⏯️ КЕРУВАННЯ ГРОЮ: справжня пауза ── */

  async function pauseGame() {
    if (!room || !isHost || actionLoading || isPaused) return;

    setActionLoading(true);

    try {
      await updateRoom({
        game_paused: true,
        paused_at: new Date().toISOString(),
        pause_reason: "Гру призупинив DM",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function resumeGame() {
    if (!room || !isHost || actionLoading || !isPaused) return;

    setActionLoading(true);

    try {
      // Таймер рахується від phase_deadline, тому resume просто
      // зсуває дедлайн на час, який гра простояла на паузі.
      const pausedMs = room.paused_at
        ? Date.now() - new Date(room.paused_at).getTime()
        : 0;

      const nextDeadline = room.phase_deadline
        ? new Date(
            new Date(room.phase_deadline).getTime() + Math.max(0, pausedMs)
          ).toISOString()
        : null;

      await updateRoom({
        game_paused: false,
        paused_at: null,
        pause_reason: null,
        phase_deadline: nextDeadline,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function extendTimer(seconds: number) {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      const baseDeadline = room.phase_deadline;
      const base = baseDeadline
        ? new Date(baseDeadline).getTime()
        : Date.now() + timeLeft * 1000;

      const next = new Date(Math.max(Date.now(), base + seconds * 1000));

      await updateRoom({ phase_deadline: next.toISOString() });
    } finally {
      setActionLoading(false);
    }
  }

  /* ── 📨 / 🎭 / ⚡: ведучий керує сценою ── */

  async function sendDmMessage(text: string) {
    if (!room || !isHost || !text.trim() || actionLoading) return;

    setActionLoading(true);

    try {
      await updateRoom({ game_message: `📢 ${text.trim()}` });
      setDmMessage("");
    } finally {
      setActionLoading(false);
    }
  }

  async function triggerEvent(icon: string, title: string, text: string) {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      await updateRoom({
        catastrophe: `${icon} ${title}`,
        catastrophe_description: text,
      });

      setChaosOpen(false);
    } finally {
      setActionLoading(false);
    }
  }

  async function launchCatastrophe() {
    if (!room || !isHost || actionLoading) return;

    const catastrophe = catastrophes[selectedCatastrophe];

    setActionLoading(true);

    try {
      await updateRoom({
        catastrophe: catastrophe.title,
        catastrophe_description: `${catastrophe.icon} ${catastrophe.description}`,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function clearCatastrophe() {
    if (!room || !isHost || actionLoading) return;

    setActionLoading(true);

    try {
      await updateRoom({ catastrophe: null, catastrophe_description: null });
    } finally {
      setActionLoading(false);
    }
  }

  async function returnToLobby() {
    if (!room || actionLoading) return;

    // Лише DM скидає стан кімнати. Після оновлення rooms усі гравці,
    // які залишилися на /game, отримають realtime-оновлення та перейдуть у лобі.
    if (isHost) {
      setActionLoading(true);

      try {
        const [charactersDelete, votesDelete, playersReset] = await Promise.all([
          supabase.from("characters").delete().eq("room_id", room.id),
          supabase.from("player_requests").delete().eq("room_id", room.id),
          supabase.from("votes").delete().eq("room_id", room.id),
          supabase.from("players").update({ is_alive: true }).eq("room_id", room.id),
        ]);

        if (charactersDelete.error) throw charactersDelete.error;
        if (votesDelete.error) throw votesDelete.error;
        if (playersReset.error) throw playersReset.error;

        const { error: roomResetError } = await supabase
          .from("rooms")
          .update({
            status: "waiting",
            starting_players: 0,
            bunker_capacity: 2,
            game_round: 0,
            game_stage: "waiting",
            game_phase: "waiting",
            defense_index: 0,
            current_speaker_id: null,
            catastrophe: null,
            catastrophe_description: null,
            voting_mode: "normal",
            tied_player_ids: [],
            game_finished_at: null,
            winner_ids: [],
            phase_started_at: null,
            round_started_at: null,
            round_ends_at: null,
            current_character: null,
            catastrophe_title: null,
            catastrophe_active: false,
            game_message: "Очікуємо на наступну гру.",
            briefing_started_at: null,
            discussion_ends_at: null,
            phase_deadline: null,
            game_paused: false,
            paused_at: null,
            pause_reason: null,
          })
          .eq("id", room.id);

        if (roomResetError) throw roomResetError;

        router.push(
          `/lobby?room=${room.code}&host=true&hostName=${encodeURIComponent(
            room.host_name
          )}`
        );
      } catch (error) {
        console.error("returnToLobby reset error:", error);
        alert("Не вдалося повернути кімнату в лобі. Спробуй ще раз.");
      } finally {
        setActionLoading(false);
      }

      return;
    }

    // Гравець не змінює спільний стан кімнати — просто відкриває лобі.
    router.push(
      `/lobby?room=${room.code}&player=${encodeURIComponent(playerName ?? "")}`
    );
  }

  async function restartSameRoom() {
    if (!room || !isHost || actionLoading) return;

    const confirmed = window.confirm("Почати нову гру в цій самій кімнаті?");

    if (!confirmed) return;

    setActionLoading(true);

    try {
      await supabase.from("characters").delete().eq("room_id", room.id);
      await supabase.from("player_requests").delete().eq("room_id", room.id);
      await supabase.from("votes").delete().eq("room_id", room.id);
      await supabase.from("players").update({ is_alive: true }).eq("room_id", room.id);

      const startingPlayers = players.length;

      /* Бункер має бути тісним: 25%–45% гравців, але не менше 2 місць
       * і не більше 6. Інакше на 12 гравців припадає 8 місць і нікого
       * не цікаво виганяти. */
      const minCapacity = Math.max(2, Math.ceil(startingPlayers * 0.25));

      const maxCapacity = Math.max(
        minCapacity,
        Math.min(6, Math.floor(startingPlayers * 0.45))
      );

      const bunkerCapacity =
        Math.floor(Math.random() * (maxCapacity - minCapacity + 1)) + minCapacity;

      const roomUpdate = await supabase
        .from("rooms")
        .update({
          // Return the whole room to the lobby. Players currently on
          // /game watch this row and loadGame redirects them when status
          // becomes "waiting". Character generation should happen when
          // the host starts the next game from the lobby.
          status: "waiting",
          starting_players: 0,
          bunker_capacity: bunkerCapacity,
          game_round: 0,
          game_stage: "waiting",
          game_phase: "waiting",
          defense_index: 0,
          current_speaker_id: null,
          catastrophe: null,
          catastrophe_description: null,
          voting_mode: "normal",
          tied_player_ids: [],
          game_finished_at: null,
          winner_ids: [],
          phase_started_at: null,
          round_started_at: null,
          phase_deadline: null,
          game_paused: false,
          paused_at: null,
          pause_reason: null,
        })
        .eq("id", room.id);

      if (roomUpdate.error) throw roomUpdate.error;

      // bunkerCapacity обчислено вище — використаємо його, коли лобі
      // згенерує нові персонажі для наступної гри.
      void bunkerCapacity;

      router.push(
        `/lobby?room=${room.code}&host=true&hostName=${encodeURIComponent(
          room.host_name
        )}`
      );
    } catch (error) {
      console.error("restartSameRoom error:", error);
      alert("Не вдалося перезапустити гру.");
    } finally {
      setActionLoading(false);
    }
  }

  /* ── Таймер: накопичений час + пауза ── */

  useEffect(() => {
    if (room?.game_phase !== "defense" || !room?.phase_started_at) {
      setTimeLeft(120);
      return;
    }

    if (isPaused) return; // таймер завмирає і відновлюється з тих самих секунд

    const deadlineIso = room.phase_deadline ?? null;
    const startedIso = room.phase_started_at;

    const updateTimer = () => {
      if (deadlineIso) {
        const remaining = Math.floor(
          (new Date(deadlineIso).getTime() - Date.now()) / 1000
        );

        setTimeLeft(Math.max(0, remaining));
        return;
      }

      const startedAt = new Date(startedIso).getTime();

      const elapsed = Math.floor((Date.now() - startedAt) / 1000);

      setTimeLeft(Math.max(0, 120 - elapsed));
    };

    let lastTickSecond = -1;
    let timeUpPlayed = false;

    const tickedUpdate = () => {
      updateTimer();

      if (isPaused || !soundOn) return;

      const deadlineIso2: string | null = room.phase_deadline ?? null;
      const startedIso2: string | null = room.phase_started_at ?? null;

      const left = deadlineIso2
        ? Math.max(
            0,
            Math.floor(
              (new Date(deadlineIso2).getTime() - Date.now()) / 1000
            )
          )
        : startedIso2
        ? Math.max(
            0,
            120 -
              Math.floor(
                (Date.now() - new Date(startedIso2).getTime()) / 1000
              )
          )
        : 120;

      /* Цокаємо останні 10 секунд, по разу на секунду. */
      if (left <= 10 && left > 0 && left !== lastTickSecond) {
        lastTickSecond = left;
        playSound("urgent");
      }

      /* Час вийшов — один раз. */
      if (left === 0 && !timeUpPlayed) {
        timeUpPlayed = true;
        playSound("timeout");
      }
    };

    tickedUpdate();

    const interval = setInterval(tickedUpdate, 500);

    return () => {
      clearInterval(interval);
    };
  }, [
    room?.game_phase,
    room?.phase_started_at,
    room?.phase_deadline,
    room?.current_speaker_id,
    isPaused,
  ]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`game-${room.id}-${isHost ? "host" : playerName}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        () => {
          loadGame();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        () => {
          loadGame();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${room.id}` },
        () => {
          loadGame();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "characters", filter: `room_id=eq.${room.id}` },
        () => {
          loadGame();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_requests", filter: `room_id=eq.${room.id}` },
        () => {
          loadGame();
        }
      )
      .subscribe();

    const syncInterval = setInterval(() => {
      loadGame();
    }, 1500);

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [room?.id, playerName, isHost]);

  useEffect(() => {
    loadGame();
  }, [roomCode, playerName, isHost]);

  /* Трек і стан гулу приходять із кімнати — їх задає DM для всіх.
   * Локальний `ambienceMuted` — це лише «вимкнути собі». */
  const ambienceTrack = (room?.ambience_track ?? "bunker") as AmbienceTrack;
  const ambienceActive = Boolean(room?.ambience_on) && !ambienceMuted;

  /* Браузер тримає аудіо заблокованим, поки користувач не клікне.
   * Ловимо перший клік у документі й розблоковуємо контекст. */
  useEffect(() => {
    const unlock = () => {
      getAudioContext();

      if (ambienceActive) {
        startAmbience(ambienceTrack);
      }
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ambienceActive, ambienceTrack]);

  /* Гул живе, поки гра триває і DM його ввімкнув. */
  useEffect(() => {
    const inGame =
      Boolean(room?.id) &&
      room?.game_phase !== "waiting" &&
      room?.status !== "waiting";

    if (inGame && ambienceActive) {
      startAmbience(ambienceTrack);
    } else {
      stopAmbience();
    }
  }, [
    room?.id,
    room?.game_phase,
    room?.status,
    ambienceActive,
    ambienceTrack,
  ]);

  /* Зміна треку на льоту — перезапускаємо гул із новими параметрами. */
  useEffect(() => {
    if (!ambienceActive) return;

    stopAmbience();

    const timer = setTimeout(() => {
      startAmbience(ambienceTrack);
    }, 1500);

    return () => clearTimeout(timer);
  }, [ambienceTrack]);

  /* ── Флеш-анонси: раунд / подія / оголошення DM ──
   * Порівнюємо стан кімнати з попереднім і показуємо банер, який сам зникає. */

  useEffect(() => {
    if (!room) return;

    const snapshot: {
      round: number;
      catastrophe: string | null;
      message: string | null;
      aliveCount: number;
      phase: string;
      speakerId: string | null;
    } = {
      round: currentRound,
      catastrophe: room.catastrophe ?? null,
      message: room.game_message ?? null,
      aliveCount: alivePlayers.length,
      phase: room.game_phase,
      speakerId: room.current_speaker_id ?? null,
    };

    const previous = lastSeenRef.current;

    if (!previous) {
      lastSeenRef.current = snapshot;
      return;
    }

    const stamp = Date.now();
    const stage = stages.find((item) => item.round === snapshot.round);

    /* Хтось вибув — трясемо екран і граємо звук. */
    if (alivePlayers.length < (previous.aliveCount ?? alivePlayers.length)) {
      setShakeKey((value) => value + 1);
      if (soundOn) playSound("eliminate");
    }

    if (snapshot.round !== previous.round && snapshot.round >= 1) {
      setFlashKey((value) => value + 1);
      if (soundOn) playSound("round");

      setFlash({
        kind: "round",
        round: snapshot.round,
        title: stage ? `${stage.icon} РАУНД ${snapshot.round}` : `РАУНД ${snapshot.round}`,
        text: stage ? `Відкриваємо: ${stage.title}` : "Нова характеристика",
        stamp,
      });
    } else if (
      snapshot.catastrophe !== previous.catastrophe &&
      snapshot.catastrophe
    ) {
      if (soundOn) playSound("event");

      setFlash({
        kind: "event",
        round: snapshot.round,
        title: snapshot.catastrophe,
        text: room.catastrophe_description ?? "",
        stamp,
      });
    } else if (snapshot.message !== previous.message && snapshot.message) {
      if (soundOn) playSound("message");

      setFlash({
        kind: "message",
        round: snapshot.round,
        title: snapshot.message,
        text: "Ведучий звертається до всіх",
        stamp,
      });
    }

    /* Почався захист — вступний тон. */
    if (room.game_phase === "defense" && previous.phase !== "defense") {
      if (soundOn) playSound("defense");
    }

    /* Змінився спікер — «свуш» передачі слова. */
    if (
      room.game_phase === "defense" &&
      room.current_speaker_id !== previous.speakerId &&
      previous.speakerId !== null
    ) {
      if (soundOn) playSound("speaker");
    }

    /* Почалось голосування — граємо сигнал. */
    if (room.game_phase === "voting" && previous.phase !== "voting") {
      if (soundOn) playSound("voting");
    }

    lastSeenRef.current = snapshot;
  }, [room, currentRound, alivePlayers.length, soundOn]);

  /* Банер живе 9 секунд, далі зникає сам.
   * Залежимо лише від мітки часу, щоб новий банер перезапускав таймер,
   * а повторний рендер із тим самим банером — ні. */
  /* Звук фіналу — один раз, коли бункер закрився. */
  const finalSoundRef = useRef(false);

  useEffect(() => {
    if (room?.game_phase !== "final") {
      finalSoundRef.current = false;
      return;
    }

    if (finalSoundRef.current) return;

    finalSoundRef.current = true;

    if (soundOn) playSound("final");
  }, [room?.game_phase, soundOn]);

  const flashStamp = flash?.stamp ?? null;

  useEffect(() => {
    if (flashStamp === null) return;

    const timer = setTimeout(() => setFlash(null), 9000);

    return () => clearTimeout(timer);
  }, [flashStamp]);

  if (loading || !room) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl">☢️</div>
          <p className="mt-4 text-gray-400">Завантаження бункера...</p>
        </div>
      </main>
    );
  }

  /* ── Спільні шматки сцени (пауза + оголошення нового раунду) ── */

  const pauseBanner = isPaused ? (
    <div className="mt-6 rounded-3xl border-2 border-amber-500 bg-amber-950/40 p-6 text-center">
      <div className="text-3xl font-black text-amber-300 md:text-4xl">
        ⏸️ ГРУ ПРИЗУПИНЕНО
      </div>
      <p className="mt-3 text-amber-200/80">
        {room.pause_reason ?? "Гру призупинив DM"}
      </p>
      <p className="mt-1 text-sm text-amber-200/50">
        {isHost
          ? `Таймер зупинено на ${formatClock(timeLeft)}. Продовження поверне рівно ці секунди.`
          : "Усі таймери зупинені. Дії недоступні до продовження."}
      </p>
    </div>
  ) : null;

  const roundBanner = isFreshRound && room.game_phase === "reveal" ? (
    <section className="mt-6 overflow-hidden rounded-3xl border border-red-500/60 bg-gradient-to-r from-red-950/80 via-gray-950 to-black p-6 shadow-[0_0_35px_rgba(239,68,68,0.12)] md:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Новий раунд розпочато
          </div>

          <h2 className="mt-4 text-4xl font-black md:text-6xl">
            {currentStage?.icon} РАУНД {currentRound}
          </h2>

          <p className="mt-3 text-xl text-gray-200">
            Зараз відкривається{" "}
            <span className="font-black text-red-300">{currentStage?.title}</span>
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-red-500/30 bg-black/40 px-6 py-5 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Відкриваємо
          </div>
          <div className="mt-2 text-3xl font-black text-red-300">
            {currentStage?.icon} {currentStage?.title}
          </div>
        </div>
      </div>
    </section>
  ) : null;

  /* ════════════════════════════════════════════════════════════
   * GAME MASTER — ПУЛЬТ ВЕДУЧОГО
   * ════════════════════════════════════════════════════════════ */

  if (isHost) {
    const voteResults = getVoteResults();

    const submittedVoters = new Set(votes.map((vote) => vote.voter_id));

    const eligibleVoters = alivePlayers.filter(
      (player) => !isTiebreak || !tiedPlayerIds.includes(player.id)
    );

    const manualCandidates = alivePlayers.filter((player) =>
      tiedPlayerIds.includes(player.id)
    );

    const speakerCharacter = currentSpeaker
      ? characters.find((item) => item.player_id === currentSpeaker.id)
      : undefined;

    return (
      <main className={`min-h-screen bg-black text-white px-4 py-6 md:px-8 ${shakeClass}`}>
        <style dangerouslySetInnerHTML={{ __html: gameAnimations }} />
        {roundFlash}
        <div className="mx-auto max-w-[1500px]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            {/* ── ЛІВА КОЛОНКА: стан гри та дії ── */}
            <div className="min-w-0">
              <div className="rounded-3xl border border-red-900 bg-red-950/20 p-6 md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black">
                        GAME MASTER
                      </span>
                      <span className="text-sm text-gray-500">ROOM {room.code}</span>
                    </div>

                    <h1 className="mt-4 text-4xl font-black md:text-5xl">
                      🎛️ DM CONTROL
                    </h1>

                    <p className="mt-2 text-gray-400">{room.host_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                      <div className="text-xs text-gray-500">РАУНД</div>
                      <div className="mt-1 text-3xl font-black">
                        {currentRound}/6
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                      <div className="text-xs text-gray-500">ЖИВІ</div>
                      <div className="mt-1 text-3xl font-black">
                        {alivePlayers.length}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                      <div className="text-xs text-gray-500">БУНКЕР</div>
                      <div className="mt-1 text-3xl font-black">
                        {room.bunker_capacity}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                      <div className="text-xs text-gray-500">ТАЙМЕР</div>
                      <div
                        className={`mt-1 text-3xl font-black ${
                          isPaused ? "text-amber-400" : ""
                        }`}
                      >
                        {room.game_phase === "defense"
                          ? formatClock(timeLeft)
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {pauseBanner}
              {roundBanner}

              {room.game_message && (
                <div className="mt-6 rounded-3xl border border-sky-800 bg-sky-950/30 p-5">
                  <div className="text-xs uppercase tracking-[0.25em] text-sky-400">
                    📢 ОГОЛОШЕННЯ (бачать усі)
                  </div>
                  <p className="mt-2 text-lg text-sky-100">{room.game_message}</p>
                </div>
              )}

              {/* ⏯️ КЕРУВАННЯ ГРОЮ */}
              <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <div className="text-sm uppercase tracking-[0.2em] text-gray-500">
                  ⏯️ КЕРУВАННЯ ГРОЮ
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {isPaused ? (
                    <button
                      onClick={resumeGame}
                      disabled={actionLoading}
                      className="rounded-xl bg-amber-500 px-7 py-5 text-lg font-black text-black hover:bg-amber-400 disabled:opacity-40"
                    >
                      ▶️ ПРОДОВЖИТИ
                    </button>
                  ) : (
                    <button
                      onClick={pauseGame}
                      disabled={actionLoading}
                      className="rounded-xl bg-amber-600 px-7 py-5 text-lg font-black hover:bg-amber-500 disabled:opacity-40"
                    >
                      ⏸ ПАУЗА ГРИ
                    </button>
                  )}

                  <button
                    onClick={() => extendTimer(30)}
                    disabled={actionLoading || isPaused}
                    className="rounded-xl border border-gray-700 px-6 py-5 font-bold hover:bg-gray-900 disabled:opacity-40"
                  >
                    +30 сек
                  </button>

                  <button
                    onClick={() => extendTimer(-30)}
                    disabled={actionLoading || isPaused}
                    className="rounded-xl border border-gray-700 px-6 py-5 font-bold hover:bg-gray-900 disabled:opacity-40"
                  >
                    −30 сек
                  </button>

                  <button
                    onClick={() => updateRoom({ game_message: null })}
                    disabled={actionLoading || !room.game_message}
                    className="rounded-xl border border-gray-700 px-6 py-5 font-bold hover:bg-gray-900 disabled:opacity-40"
                  >
                    🧹 Прибрати оголошення
                  </button>
                </div>

                <p className="mt-4 text-sm text-gray-500">
                  Пауза зупиняє таймер і блокує дії. Після продовження у спікера
                  залишиться рівно стільки секунд, скільки було до паузи.
                </p>
              </div>

              {/* Фаза + катастрофа */}
              {currentStage && (
                <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500">
                        ПОТОЧНА ФАЗА
                      </div>
                      <div className="mt-2 text-3xl font-black">
                        {currentStage.icon} {currentStage.title}
                      </div>
                      <div className="mt-1 text-gray-500">
                        Раунд {currentRound} · {phaseLabel}
                      </div>
                    </div>

                    {room.game_phase === "defense" && (
                      <div className="rounded-2xl border border-blue-900 bg-blue-950/20 px-6 py-4 text-center">
                        <div className="text-xs uppercase tracking-widest text-gray-500">
                          🎤 ЗАРАЗ ГОВОРИТЬ
                        </div>
                        <div className="mt-1 text-2xl font-black">
                          {currentSpeaker?.name ?? "—"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {room.catastrophe && (
                <div className="mt-6 rounded-3xl border border-yellow-800 bg-yellow-950/20 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-yellow-600">
                        НА СЦЕНІ ЗАРАЗ
                      </div>
                      <div className="mt-2 text-3xl font-black text-yellow-400">
                        {room.catastrophe}
                      </div>
                      <p className="mt-3 max-w-3xl text-gray-300">
                        {room.catastrophe_description}
                      </p>
                    </div>

                    <button
                      onClick={clearCatastrophe}
                      disabled={actionLoading}
                      className="rounded-xl border border-yellow-800 px-5 py-3 font-bold text-yellow-400 hover:bg-yellow-950 disabled:opacity-40"
                    >
                      ПРИБРАТИ
                    </button>
                  </div>
                </div>
              )}

              {/* 🔀 ВКЛАДКИ ПУЛЬТА */}
              <div className="mt-6 flex flex-wrap gap-2 rounded-3xl border border-gray-800 bg-gray-950 p-2">
                {([
                  { id: "scene", icon: "🎭", label: "Сцена" },
                  { id: "sound", icon: "🔊", label: "Звук" },
                  { id: "requests", icon: "📨", label: "Запити" },
                  { id: "chaos", icon: "⚡", label: "Хаос" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDmTab(tab.id)}
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition ${
                      dmTab === tab.id
                        ? "bg-red-600 text-white"
                        : "text-gray-400 hover:bg-gray-900"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* 🎭 СЦЕНА */}
              {dmTab === "scene" && (
              <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-gray-500">
                      🎭 СЦЕНА
                    </div>
                    <div className="mt-3 text-3xl font-black">
                      {currentSpeaker?.name ?? "Немає спікера"}
                    </div>
                    {speakerCharacter && (
                      <div className="mt-2 text-sm text-gray-500">
                        {speakerCharacter.profession} · {speakerCharacter.age} років
                      </div>
                    )}
                  </div>

                  {room.game_phase === "defense" && (
                    <div className="rounded-2xl border border-gray-800 bg-black/40 px-6 py-4 text-center">
                      <div className="text-xs uppercase tracking-widest text-gray-500">
                        ТАЙМЕР
                      </div>
                      <div
                        className={`mt-1 text-4xl font-black ${
                          isPaused ? "text-amber-400" : ""
                        }`}
                      >
                        {formatClock(timeLeft)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={nextSpeaker}
                    disabled={actionLoading || isPaused}
                    className="rounded-xl bg-blue-600 px-6 py-4 font-bold hover:bg-blue-500 disabled:opacity-40"
                  >
                    🎤 ПЕРЕДАТИ СЛОВО
                  </button>

                  <button
                    onClick={startVoting}
                    disabled={actionLoading || isPaused}
                    className="rounded-xl border border-gray-700 px-6 py-4 font-bold hover:bg-gray-900 disabled:opacity-40"
                  >
                    ✅ ЗАВЕРШИТИ ВИСТУП
                  </button>

                  <button
                    onClick={() => setInterventionOpen((value) => !value)}
                    disabled={actionLoading}
                    className="rounded-xl border border-purple-800 px-6 py-4 font-bold text-purple-300 hover:bg-purple-950/40 disabled:opacity-40"
                  >
                    🎲 ВТРУТИТИСЯ В ДИСКУСІЮ
                  </button>
                </div>

                {interventionOpen && (
                  <div className="mt-5 rounded-2xl border border-purple-900 bg-purple-950/20 p-5">
                    <div className="font-black text-purple-300">
                      Що відбувається?
                    </div>

                    <div className="mt-4 grid gap-2">
                      {dmPromptIdeas.map((idea) => (
                        <button
                          key={idea.label}
                          onClick={() => sendDmMessage(idea.text)}
                          disabled={actionLoading}
                          className="rounded-xl border border-purple-900 bg-black/40 px-4 py-3 text-left hover:border-purple-600 disabled:opacity-40"
                        >
                          <span className="font-bold">
                            {idea.icon} {idea.label}
                          </span>
                          <span className="mt-1 block text-sm text-gray-400">
                            {idea.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* 🔊 САУНД-БАР DM */}
              <div className="mt-6 rounded-3xl border border-fuchsia-900 bg-fuchsia-950/20 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-fuchsia-300">
                      🔊 САУНД-БАР
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Гул чути в усіх гравців. Кожен може вимкнути його собі.
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      getAudioContext();
                      await updateRoom({
                        ambience_on: !room.ambience_on,
                        ambience_track: room.ambience_track ?? "bunker",
                      });
                    }}
                    disabled={actionLoading}
                    className={`rounded-xl px-5 py-3 font-black disabled:opacity-40 ${
                      room.ambience_on
                        ? "bg-fuchsia-600 hover:bg-fuchsia-500"
                        : "border border-fuchsia-800 text-fuchsia-300 hover:bg-fuchsia-950"
                    }`}
                  >
                    {room.ambience_on ? "🎚️ ФОН УВІМКНЕНО" : "🚫 ФОН ВИМКНЕНО"}
                  </button>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {ambienceTracks.map((track) => {
                    const active = ambienceTrack === track.value;

                    return (
                      <button
                        key={track.value}
                        onClick={async () => {
                          getAudioContext();

                          await updateRoom({
                            ambience_on: track.value !== "silence",
                            ambience_track: track.value,
                          });
                        }}
                        disabled={actionLoading}
                        className={`rounded-2xl border p-4 text-left transition disabled:opacity-40 ${
                          active
                            ? "border-fuchsia-500 bg-fuchsia-900/40"
                            : "border-gray-800 bg-black/40 hover:border-fuchsia-800"
                        }`}
                      >
                        <div className="text-2xl">{track.icon}</div>
                        <div className="mt-2 font-black">{track.label}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {track.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-xl border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300">
                    🔊 Власні звуки: {soundOn ? "увімкнено" : "вимкнено"}
                  </span>

                  <button
                    onClick={() => {
                      getAudioContext();
                      setSoundOn((value) => !value);
                    }}
                    className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-bold hover:bg-gray-900"
                  >
                    {soundOn ? "🔇 Вимкнути собі" : "🔊 Увімкнути собі"}
                  </button>

                  <button
                    onClick={() => playSound("event")}
                    disabled={!soundOn}
                    className="rounded-xl border border-gray-700 px-4 py-2 text-xs font-bold hover:bg-gray-900 disabled:opacity-40"
                  >
                    ▶️ Перевірити звук
                  </button>
                </div>
              </div>

              {/* 📨 ВХІДНІ ЗАПИТИ ВІД ГРАВЦІВ */}
              {(() => {
                const pending = requests.filter((item) => item.status === "pending");
                const resolved = requests
                  .filter((item) => item.status !== "pending")
                  .slice(0, 5);

                return (
                  <div
                    className={`mt-6 rounded-3xl border p-6 ${
                      pending.length
                        ? "border-red-600 bg-red-950/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
                        : "border-gray-800 bg-gray-950"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm uppercase tracking-[0.2em] text-gray-400">
                        📨 ЗАПИТИ ВІД ГРАВЦІВ
                      </div>

                      {pending.length > 0 && (
                        <span className="animate-pulse rounded-full bg-red-600 px-3 py-1 text-xs font-black">
                          🔴 {pending.length} НОВИХ
                        </span>
                      )}
                    </div>

                    {pending.length === 0 && (
                      <p className="mt-4 text-gray-500">
                        Нових запитів немає. Гравці можуть надіслати запит зі свого екрана.
                      </p>
                    )}

                    <div className="mt-5 space-y-4">
                      {pending.map((request) => {
                        const author = players.find((item) => item.id === request.player_id);
                        const authorCharacter = characters.find(
                          (item) => item.player_id === request.player_id
                        );
                        const meta = requestMeta(request.type);

                        return (
                          <div
                            key={request.id}
                            className="rounded-2xl border border-red-900 bg-black/50 p-5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xl font-black">
                                {author?.name ?? "Гравець"}
                              </div>
                              <span className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-bold text-gray-300">
                                {meta.icon} {meta.label}
                              </span>
                            </div>

                            <p className="mt-3 text-lg text-gray-100">
                              «{request.message}»
                            </p>

                            {request.type === "perk" && authorCharacter?.perk && (
                              <p className="mt-2 text-sm text-blue-300">
                                ⭐ Його здібність: {authorCharacter.perk}
                              </p>
                            )}

                            <textarea
                              value={replyDrafts[request.id] ?? ""}
                              onChange={(event) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [request.id]: event.target.value,
                                }))
                              }
                              rows={2}
                              placeholder="Відповідь (необов'язково): «Дозволяю. Максим, у тебе 30 секунд.»"
                              className="mt-4 w-full resize-none rounded-xl border border-gray-700 bg-black p-3 text-sm text-white outline-none focus:border-red-500"
                            />

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => resolveRequest(request, "approved")}
                                disabled={actionLoading}
                                className="rounded-xl bg-green-700 px-4 py-3 text-sm font-black hover:bg-green-600 disabled:opacity-40"
                              >
                                ✅ Дозволити
                              </button>

                              <button
                                onClick={() => resolveRequest(request, "approved", true)}
                                disabled={actionLoading}
                                className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-black hover:bg-sky-600 disabled:opacity-40"
                              >
                                📢 Дозволити + оголосити всім
                              </button>

                              <button
                                onClick={() => resolveRequest(request, "rejected")}
                                disabled={actionLoading}
                                className="rounded-xl border border-red-800 px-4 py-3 text-sm font-black text-red-400 hover:bg-red-950 disabled:opacity-40"
                              >
                                ❌ Відхилити
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {resolved.length > 0 && (
                      <details className="mt-5">
                        <summary className="cursor-pointer text-xs font-bold text-gray-500">
                          Історія рішень
                        </summary>
                        <div className="mt-3 space-y-2">
                          {resolved.map((request) => (
                            <div
                              key={request.id}
                              className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-sm"
                            >
                              <span className="font-bold">
                                {players.find((item) => item.id === request.player_id)?.name ??
                                  "Гравець"}
                              </span>{" "}
                              {request.status === "approved" ? "✅" : "❌"}{" "}
                              <span className="text-gray-400">{request.message}</span>
                              {request.dm_reply && (
                                <div className="mt-1 text-xs text-sky-300">
                                  DM: {request.dm_reply}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}

              {/* 📨 ЗАПИТИ ГРАВЦІВ */}
              {dmTab === "requests" && (
              <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm uppercase tracking-[0.2em] text-gray-500">
                    📨 ЗАПИТИ ГРАВЦІВ
                  </div>
                  {submittedVoters.size > 0 && room.game_phase === "voting" && (
                    <div className="rounded-full bg-red-950 px-3 py-1 text-xs font-black text-red-300">
                      🔴 {submittedVoters.size} / {eligibleVoters.length}
                    </div>
                  )}
                </div>

                {room.game_phase === "voting" ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {alivePlayers.map((player) => {
                      const voted = submittedVoters.has(player.id);

                      return (
                        <div
                          key={player.id}
                          className={`rounded-2xl border p-4 ${
                            voted
                              ? "border-green-900 bg-green-950/20"
                              : "border-gray-800 bg-gray-900"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-black">{player.name}</div>
                            <div className="text-sm font-bold">
                              {voted ? "✅" : "⏳"}
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {voted ? "Голос віддано" : "Ще не голосував"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-gray-500">
                    Запити надходять під час голосування та захисту. Зараз система
                    показує стан виступів.
                  </p>
                )}

                <div className="mt-5 rounded-2xl border border-gray-800 bg-black/40 p-4">
                  <div className="text-xs uppercase tracking-widest text-gray-500">
                    ✏️ Відповісти / оголосити всім
                  </div>

                  <textarea
                    value={dmMessage}
                    onChange={(event) => setDmMessage(event.target.value)}
                    rows={3}
                    placeholder="Напр.: Дозволяю. Максим, у тебе 30 секунд."
                    className="mt-3 w-full resize-none rounded-xl border border-gray-700 bg-black p-4 text-white outline-none focus:border-red-500"
                  />

                  <button
                    onClick={() => sendDmMessage(dmMessage)}
                    disabled={actionLoading || !dmMessage.trim()}
                    className="mt-3 rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500 disabled:opacity-40"
                  >
                    📢 НАДІСЛАТИ ВСІМ
                  </button>
                </div>
              </div>
              )}

              {/* ⚡ ХАОС */}
              {dmTab === "chaos" && (
              <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <div className="text-sm uppercase tracking-[0.2em] text-gray-500">
                  ⚡ ХАОС
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => setChaosOpen((value) => !value)}
                    disabled={actionLoading}
                    className="rounded-xl bg-yellow-700 px-6 py-4 font-black hover:bg-yellow-600 disabled:opacity-40"
                  >
                    ⚡ ВЛАШТУВАТИ ХАОС
                  </button>

                  <button
                    onClick={() =>
                      triggerEvent(
                        "🎲",
                        "РАНДОМНА ПОДІЯ",
                        chaosEvents[Math.floor(Math.random() * chaosEvents.length)]
                          .text
                      )
                    }
                    disabled={actionLoading}
                    className="rounded-xl border border-yellow-800 px-6 py-4 font-bold text-yellow-300 hover:bg-yellow-950/40 disabled:opacity-40"
                  >
                    🎲 Мені нудно — рандом
                  </button>
                </div>

                {chaosOpen && (
                  <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {chaosEvents.map((event) => (
                      <button
                        key={event.title}
                        onClick={() => triggerEvent(event.icon, event.title, event.text)}
                        disabled={actionLoading}
                        className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left transition hover:border-yellow-700 disabled:opacity-40"
                      >
                        <div className="text-3xl">{event.icon}</div>
                        <div className="mt-3 font-black">{event.title}</div>
                        <div className="mt-2 text-sm text-gray-500">{event.text}</div>
                      </button>
                    ))}
                  </div>
                )}

                <details className="mt-5 rounded-2xl border border-gray-800 bg-black/40 p-5">
                  <summary className="cursor-pointer font-bold text-gray-300">
                    ☢️ Катаклізми бункера (старі)
                  </summary>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {catastrophes.map((catastrophe, index) => (
                      <button
                        key={catastrophe.title}
                        onClick={() => setSelectedCatastrophe(index)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selectedCatastrophe === index
                            ? "border-yellow-600 bg-yellow-950/30"
                            : "border-gray-800 bg-gray-900 hover:border-gray-600"
                        }`}
                      >
                        <div className="text-2xl">{catastrophe.icon}</div>
                        <div className="mt-2 font-black">{catastrophe.title}</div>
                        <div className="mt-2 text-sm text-gray-500">
                          {catastrophe.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={launchCatastrophe}
                    disabled={actionLoading}
                    className="mt-4 rounded-xl bg-yellow-700 px-6 py-3 font-bold hover:bg-yellow-600 disabled:opacity-40"
                  >
                    ⚡ ЗАПУСТИТИ КАТАКЛІЗМ
                  </button>
                </details>
              </div>
              )}

              {/* ФАЗОВІ ПАНЕЛІ */}
              {room.game_phase === "briefing" && (
                <div className="mt-6 rounded-3xl border border-blue-900 bg-blue-950/20 p-8">
                  <div className="text-sm uppercase tracking-[0.3em] text-blue-500">
                    🎬 БРИФІНГ
                  </div>

                  <h2 className="mt-4 text-3xl font-black">
                    ГРА ГОТОВА ДО СТАРТУ
                  </h2>

                  <p className="mt-3 max-w-3xl text-gray-400">
                    Усі гравці отримали персонажів. Коли всі готові — запускай
                    перший раунд: гравці побачать оголошення «Новий раунд
                    розпочато».
                  </p>

                  <button
                    onClick={startGame}
                    disabled={actionLoading}
                    className="mt-6 rounded-xl bg-red-600 px-7 py-4 font-black hover:bg-red-500 disabled:opacity-40"
                  >
                    {actionLoading ? "ЗАПУСКАЄМО..." : "▶️ ПОЧАТИ ГРУ"}
                  </button>
                </div>
              )}

              {room.game_phase === "final" && (
                <div className="mt-6 rounded-3xl border border-green-900 bg-green-950/20 p-8">
                  <div className="text-sm uppercase tracking-[0.3em] text-green-500">
                    ГРУ ЗАВЕРШЕНО
                  </div>

                  <h2 className="mt-4 text-5xl font-black">🏆 БУНКЕР ЗАКРИТО</h2>

                  <p className="mt-4 text-gray-400">
                    У бункері залишилось {alivePlayers.length} гравців.
                  </p>

                  <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {alivePlayers.map((player, index) => {
                      const character = characters.find(
                        (item) => item.player_id === player.id
                      );

                      return (
                        <div
                          key={player.id}
                          className="anim-rise rounded-2xl border-2 border-green-800 bg-gradient-to-br from-green-950/40 to-black p-6"
                          style={{ animationDelay: `${index * 120}ms` }}
                        >
                          <div className="text-3xl font-black">🏆 {player.name}</div>

                          {character && (
                            <div className="mt-4 space-y-2 text-sm text-gray-300">
                              <div>🎂 {character.age} років</div>
                              <div>💼 {character.profession}</div>
                              <div>❤️ {character.health}</div>
                              <div>🧠 {character.skill}</div>
                              <div>🎒 {character.item}</div>
                              <div>😨 {character.phobia}</div>

                              {character.perk && (
                                <div className="mt-3 border-t border-blue-900 pt-3 text-blue-400">
                                  ⭐ {character.perk}
                                </div>
                              )}

                              <div className="mt-3 border-t border-gray-800 pt-3 text-yellow-400">
                                🔐 {character.secret}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-10">
                    <div className="text-sm uppercase tracking-wider text-gray-500">
                      🔐 СЕКРЕТИ ВСІХ УЧАСНИКІВ
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {players.map((player) => {
                        const character = characters.find(
                          (item) => item.player_id === player.id
                        );

                        if (!character) return null;

                        return (
                          <div
                            key={player.id}
                            className={`rounded-2xl border p-4 ${
                              player.is_alive
                                ? "border-green-900 bg-green-950/10"
                                : "border-gray-800 bg-gray-950"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black">
                                {player.is_alive ? "🏆" : "☠️"} {player.name}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                {player.is_alive ? "у бункері" : "зовні"}
                              </span>
                            </div>

                            <div className="mt-2 text-sm text-yellow-400">
                              🔐 {character.secret}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={returnToLobby}
                      className="rounded-xl border border-gray-700 px-6 py-4 font-bold hover:bg-gray-900"
                    >
                      ← ПОВЕРНУТИСЯ В ЛОБІ
                    </button>

                    <button
                      onClick={restartSameRoom}
                      disabled={actionLoading}
                      className="rounded-xl bg-red-600 px-6 py-4 font-bold hover:bg-red-500 disabled:opacity-40"
                    >
                      🔄 НОВА ГРА В ЦІЙ КІМНАТІ
                    </button>
                  </div>
                </div>
              )}

              {room.game_phase !== "final" && room.game_phase !== "briefing" && (
                <>
                  {room.game_phase === "voting" && (
                    <div className="mt-6 rounded-3xl border border-purple-900 bg-purple-950/20 p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm uppercase tracking-wider text-purple-500">
                            🗳️ ГОЛОСУВАННЯ
                          </div>
                          <h2 className="mt-2 text-3xl font-black">
                            {isTiebreak ? "ПЕРЕГОЛОСУВАННЯ" : "ГОЛОСУВАННЯ"}
                          </h2>
                        </div>

                        <div className="min-w-[240px] rounded-xl bg-black/30 px-5 py-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Голосів</span>
                            <span className="font-black">
                              {submittedVoters.size} з {eligibleVoters.length}
                            </span>
                          </div>

                          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-red-500 transition-all duration-500"
                              style={{
                                width: `${
                                  eligibleVoters.length
                                    ? Math.round(
                                        (submittedVoters.size /
                                          eligibleVoters.length) *
                                          100
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {alivePlayers.map((player) => {
                          const votesFor = voteResults.counts[player.id] ?? 0;
                          const isCandidate = tiedPlayerIds.includes(player.id);

                          return (
                            <div
                              key={player.id}
                              className={`rounded-2xl border p-5 ${
                                isCandidate
                                  ? "border-red-700 bg-red-950/30"
                                  : "border-gray-800 bg-gray-900"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-black">{player.name}</div>
                                <div className="text-2xl font-black">{votesFor}</div>
                              </div>

                              {isCandidate && (
                                <div className="mt-2 text-xs font-bold text-red-400">
                                  КАНДИДАТ
                                </div>
                              )}

                              {submittedVoters.has(player.id) && (
                                <div className="mt-2 text-xs text-green-400">
                                  ✓ ГОЛОС ВІДДАНО
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={showResults}
                        disabled={actionLoading}
                        className="mt-5 rounded-xl bg-purple-600 px-6 py-4 font-bold hover:bg-purple-500 disabled:opacity-40"
                      >
                        📊 ПОКАЗАТИ РЕЗУЛЬТАТИ
                      </button>
                    </div>
                  )}

                  {room.game_phase === "results" && (
                    <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                      <div className="text-sm uppercase tracking-wider text-gray-500">
                        📊 РЕЗУЛЬТАТИ
                      </div>

                      <h2 className="mt-2 text-3xl font-black">
                        РЕЗУЛЬТАТИ ГОЛОСУВАННЯ
                      </h2>

                      <div className="mt-5 space-y-3">
                        {[...alivePlayers]
                          .sort(
                            (a, b) =>
                              (voteResults.counts[b.id] ?? 0) -
                              (voteResults.counts[a.id] ?? 0)
                          )
                          .map((player) => (
                            <div
                              key={player.id}
                              className={`flex items-center justify-between rounded-2xl border p-5 ${
                                voteResults.leaders.includes(player.id)
                                  ? "border-red-700 bg-red-950/30"
                                  : "border-gray-800 bg-gray-900"
                              }`}
                            >
                              <div>
                                <div className="text-xl font-black">
                                  {player.name}
                                </div>
                                {voteResults.leaders.includes(player.id) && (
                                  <div className="mt-1 text-sm text-red-400">
                                    КАНДИДАТ
                                  </div>
                                )}
                              </div>

                              <div className="text-3xl font-black">
                                {voteResults.counts[player.id]}
                              </div>
                            </div>
                          ))}
                      </div>

                      {voteResults.leaders.length > 1 && (
                        <div className="mt-5 rounded-2xl border border-yellow-800 bg-yellow-950/20 p-5">
                          <div className="text-xl font-black text-yellow-400">
                            ⚠️ НІЧИЯ
                          </div>
                          <p className="mt-2 text-gray-400">
                            Кандидатів: {voteResults.leaders.length}
                          </p>
                        </div>
                      )}

                      <div className="mt-5">
                        {isManualElimination ? (
                          <div className="rounded-2xl border border-yellow-800 bg-yellow-950/20 p-6">
                            <div className="text-2xl font-black text-yellow-400">
                              👑 РІШЕННЯ GAME MASTER
                            </div>

                            <p className="mt-2 text-gray-400">
                              Переголосування неможливе. Обери, хто залишає
                              бункер — це спірна ситуація, яку підтверджує ведучий.
                            </p>

                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                              {manualCandidates.map((player) => (
                                <button
                                  key={player.id}
                                  onClick={() => hostEliminate(player.id)}
                                  disabled={actionLoading}
                                  className="rounded-xl bg-red-600 px-5 py-4 font-bold hover:bg-red-500 disabled:opacity-40"
                                >
                                  ☠️ ВИКИНУТИ {player.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={processResults}
                            disabled={actionLoading}
                            className="rounded-xl bg-red-600 px-6 py-4 font-bold hover:bg-red-500 disabled:opacity-40"
                          >
                            {voteResults.leaders.length > 1
                              ? "⚖️ ОБРОБИТИ НІЧИЮ"
                              : "☠️ ВИКИНУТИ ГРАВЦЯ"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {room.game_phase === "reveal" && (
                    <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                      <div className="text-sm uppercase tracking-wider text-gray-500">
                        🎬 РОЗКРИТТЯ
                      </div>

                      <h2 className="mt-2 text-3xl font-black">
                        {currentStage?.icon} {currentStage?.title}
                      </h2>

                      <p className="mt-3 text-gray-400">
                        Гравці зараз бачать характеристики відповідно до поточного
                        раунду — і щойно відкрита характеристика підсвічена.
                      </p>

                      <div className="mt-5">
                        {votingRounds.includes(currentRound) ? (
                          <button
                            onClick={startDefense}
                            disabled={actionLoading}
                            className="rounded-xl bg-red-600 px-6 py-4 font-bold hover:bg-red-500 disabled:opacity-40"
                          >
                            🎤 ПОЧАТИ ЗАХИСТ
                          </button>
                        ) : (
                          <button
                            onClick={startNextReveal}
                            disabled={actionLoading}
                            className="rounded-xl bg-red-600 px-6 py-4 font-bold hover:bg-red-500 disabled:opacity-40"
                          >
                            ▶️ НАСТУПНИЙ РАУНД
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── ПРАВА КОЛОНКА: DM ONLY + ГРАВЦІ ── */}
            <aside className="min-w-0">
              <div className="rounded-3xl border border-red-900/70 bg-black p-5 xl:sticky xl:top-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black uppercase tracking-[0.2em] text-red-400">
                    🔐 DM ONLY
                  </div>

                  <button
                    onClick={() => setRevealAllOpen((value) => !value)}
                    className="rounded-lg border border-gray-800 px-3 py-1 text-xs font-bold text-gray-400 hover:bg-gray-900"
                  >
                    {revealAllOpen ? "СХОВАТИ" : "ПОКАЗАТИ ВСЕ"}
                  </button>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Гравці цього не бачать. Тут усі характеристики — навіть ще не
                  розкриті.
                </p>

                <div className="mt-4 space-y-3">
                  {players.map((player) => {
                    const character = characters.find(
                      (item) => item.player_id === player.id
                    );

                    const isSpeaker = currentSpeaker?.id === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`rounded-2xl border p-4 ${
                          isSpeaker
                            ? "border-blue-700 bg-blue-950/20"
                            : player.is_alive
                            ? "border-gray-800 bg-gray-950"
                            : "border-red-950 bg-red-950/20 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-black">
                            {player.is_alive ? "🟢" : "☠️"} {player.name}
                          </div>

                          {player.is_host && (
                            <span className="rounded-md bg-red-950 px-2 py-1 text-[10px] font-black text-red-300">
                              GM
                            </span>
                          )}
                        </div>

                        {character ? (
                          <div className="mt-3 space-y-1.5 text-xs">
                            {stages.map((stage) => {
                              const isRevealed = currentRound >= stage.round;

                              return (
                                <div
                                  key={stage.round}
                                  className="flex items-start gap-2"
                                >
                                  <span>{stage.icon}</span>
                                  <span
                                    className={
                                      isRevealed
                                        ? "text-gray-200"
                                        : "text-red-300/80"
                                    }
                                  >
                                    {characterValue(character, stage.field)}
                                  </span>
                                  {!isRevealed && (
                                    <span className="text-[10px] font-black text-red-500">
                                      НЕ ВІДКРИТО
                                    </span>
                                  )}
                                </div>
                              );
                            })}

                            {character.perk && (
                              <div className="mt-2 border-t border-blue-900 pt-2 text-blue-300">
                                ⭐ {character.perk}
                              </div>
                            )}

                            <div className="mt-2 border-t border-yellow-900/50 pt-2 text-yellow-400">
                              🔐 {character.secret}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-gray-500">
                            Персонаж ще не згенеровано.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm uppercase tracking-wider text-gray-500">
                    👥 ГРАВЦІ
                  </div>
                  <div className="text-sm text-gray-500">
                    {alivePlayers.length} живих / {players.length}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {players.map((player) => (
                    <span
                      key={player.id}
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${
                        player.is_alive
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-red-950 text-red-300 line-through"
                      }`}
                    >
                      {player.is_alive ? "🟢" : "☠️"} {player.name}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-xs text-gray-500">
                  ☠️ Вибування відбувається через голосування. Ведучий лише
                  підтверджує спірну ситуацію — кнопка «вибити» схована нижче.
                </p>

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-bold text-gray-500">
                    Ручне вилучення (спірні випадки)
                  </summary>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {alivePlayers.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => hostEliminate(player.id)}
                        disabled={actionLoading}
                        className="rounded-lg border border-red-900 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-950 disabled:opacity-40"
                      >
                        ☠️ {player.name}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════════════════════════
   * PLAYER
   * ════════════════════════════════════════════════════════════ */

  /* Фінал бачать по-різному: той, хто вижив — святкує, той, кого
   * вигнали — читає, що бункер зачинився без нього. Гілку глядача
   * тому пропускаємо нижче, до його власного екрана. */
  if (room.game_phase === "final" && currentPlayer?.is_alive) {
    const winners = alivePlayers;

    return (
      <main
      key={`shake-${shakeKey}`}
      className={`min-h-screen bg-black text-white px-6 py-10 ${shakeClass}`}
    >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-red-500">
              INWEB / BUNKER
            </p>

            <h1 className="anim-rise mt-6 bg-gradient-to-r from-green-300 via-emerald-100 to-green-400 bg-clip-text text-6xl font-black text-transparent md:text-7xl">
              ☢️ БУНКЕР ЗАКРИТО
            </h1>

            <p className="mt-5 text-xl text-gray-400">Фінальний склад виживших</p>
          </div>

          <div className="mt-8 rounded-3xl border border-yellow-800 bg-yellow-950/20 p-6 text-center">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-yellow-500">
              🔐 СЕКРЕТИ РОЗКРИТО
            </div>
            <p className="mt-3 text-gray-300">
              Бункер зачинено — тепер говорять усі. Ось що кожен із вас зберігав
              у собі.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-5xl gap-5 md:grid-cols-2">
            {winners.map((player, index) => {
              const character = characters.find(
                (item) => item.player_id === player.id
              );

              return (
                <div
                  key={player.id}
                  className="anim-rise anim-glow rounded-3xl border-2 border-green-700 bg-gradient-to-br from-green-950/50 via-gray-950 to-black p-8"
                  style={{ animationDelay: `${index * 140}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-black md:text-5xl">
                      🏆 {player.name}
                    </div>
                    <span className="rounded-full bg-green-800/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-300">
                      вижив
                    </span>
                  </div>

                  {character && (
                    <div className="mt-6 space-y-3 text-gray-300">
                      <div>🎂 {character.age} років</div>
                      <div>💼 {character.profession}</div>
                      <div>❤️ {character.health}</div>
                      <div>🧠 {character.skill}</div>
                      <div>🎒 {character.item}</div>
                      <div>😨 {character.phobia}</div>

                      {character.perk && (
                        <div className="border-t border-blue-900 pt-4 text-blue-400">
                          ⭐ {character.perk}
                        </div>
                      )}

                      <div className="border-t border-green-900 pt-4 text-yellow-400">
                        🔐 {character.secret}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mx-auto mt-10 max-w-5xl">
            <div className="text-sm uppercase tracking-wider text-gray-500">
              🔐 ХТО ЩО ПРИХОВУВАВ
            </div>

            <div className="mt-4 space-y-2">
              {players.map((player) => {
                const character = characters.find(
                  (item) => item.player_id === player.id
                );

                if (!character) return null;

                return (
                  <div
                    key={player.id}
                    className={`rounded-2xl border p-4 ${
                      player.is_alive
                        ? "border-green-900 bg-green-950/10"
                        : "border-gray-800 bg-gray-950"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black">
                        {player.is_alive ? "🏆" : "☠️"} {player.name}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {player.is_alive ? "у бункері" : "залишився зовні"}
                      </span>
                    </div>

                    <div className="mt-2 text-yellow-400">
                      🔐 {character.secret}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={returnToLobby}
              className="rounded-xl border border-gray-700 px-7 py-4 font-bold hover:bg-gray-900"
            >
              ← ПОВЕРНУТИСЯ В ЛОБІ
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!currentPlayer) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <div className="text-5xl">⚠️</div>

          <h1 className="mt-5 text-3xl font-black">Гравця не знайдено</h1>

          <p className="mt-3 text-gray-500">
            Схоже, тебе більше немає в цій кімнаті.
          </p>

          <button
            onClick={returnToLobby}
            className="mt-6 rounded-xl bg-red-600 px-6 py-4 font-bold"
          >
            ПОВЕРНУТИСЯ
          </button>
        </div>
      </main>
    );
  }

  const myCharacter = characters.find(
    (character) => character.player_id === currentPlayer.id
  );

  /* ── Фіксована сцена ── */

  const flashStyle = flash ? flashStyles[flash.kind] : null;

  const flashBanner =
    flash && flashStyle ? (
      <div
        key={`flash-${flashKey}`}
        style={{ transform: "translateX(-50%)" }}
        className={`anim-drop fixed left-1/2 top-6 z-50 w-[min(92vw,760px)] rounded-3xl border-2 p-6 ${flashStyle.box}`}
      >
        <div className="flex items-start gap-4">
          <div className="text-5xl">{flashStyle.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-white/70">
              {flashStyle.label}
            </div>
            <div className={`mt-2 break-words text-2xl font-black md:text-3xl ${flashStyle.title}`}>
              {flash.title}
            </div>
            {flash.text && <p className="mt-2 text-gray-200">{flash.text}</p>}
          </div>
          <button
            onClick={() => setFlash(null)}
            className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold text-white/70 hover:bg-white/10"
          >
            ЗАКРИТИ
          </button>
        </div>
      </div>
    ) : null;

  const sceneBar = (
    <div className="sticky top-0 z-10 -mx-5 mb-6 border-b border-gray-900 bg-black/95 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black">
            {isFreshRound ? `🟢 ROUND ${currentRound}` : "☢️ BUNKER"}
          </span>

          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {phaseLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              /* Розблоковуємо аудіо на першому кліку — браузери цього
               * не дозволяють до взаємодії зі сторінкою. */
              getAudioContext();
              setSoundOn((value) => !value);
            }}
            className="rounded-xl border border-gray-800 px-3 py-2 text-sm font-bold hover:bg-gray-900"
            title="Звукові ефекти"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>

          <button
            onClick={() => {
              getAudioContext();
              setAmbienceMuted((value) => !value);
            }}
            className="rounded-xl border border-gray-800 px-3 py-2 text-sm font-bold hover:bg-gray-900"
            title="Гул бункера (задає DM)"
          >
            {ambienceActive ? "🎚️" : "🚫"}
          </button>

          {room.game_phase === "defense" && (
            <span
              className={`rounded-xl border px-4 py-2 font-black tabular-nums ${
                isPaused
                  ? "border-amber-600 text-amber-400"
                  : "border-gray-800 text-gray-200"
              }`}
            >
              ⏱️ {formatClock(timeLeft)}
            </span>
          )}

          <span className="rounded-xl border border-gray-800 px-4 py-2 text-sm font-bold">
            🏠 {alivePlayers.length}/{room.bunker_capacity}
          </span>
        </div>
      </div>

      {isPaused && (
        <div className="mx-auto mt-2 max-w-6xl rounded-lg bg-amber-950/60 px-4 py-2 text-center text-sm font-black text-amber-300">
          ⏸️ Гру призупинив DM
        </div>
      )}
    </div>
  );

  /* ════════════════════════════════════════════════════════════
   * PLAYER BRIEFING
   * ════════════════════════════════════════════════════════════ */

  /* ── Вибулий гравець стає глядачем: бачить сцену, але нічого не робить ── */

  /* ── ГЛЯДАЧ ──
   * Вибулий бачить ту саму гру, що й живі: сцену, спікера, таймер,
   * події та раунди. Йому недоступні лише дії — голос, виступ, запит
   * до DM. Раніше він бачив тільки табличку «ти вилетів» і саму гру
   * пропускав. */

  const speakerCharacter = currentSpeaker
    ? characters.find((item) => item.player_id === currentSpeaker.id)
    : undefined;

  const spectatorView = !currentPlayer.is_alive ? (
    <main
      key={`shake-${shakeKey}`}
      className={`min-h-screen bg-black text-white px-5 py-8 ${shakeClass}`}
    >
      <div className="mx-auto max-w-5xl">
        <style dangerouslySetInnerHTML={{ __html: gameAnimations }} />
        {roundFlash}
        {flashBanner}
        {sceneBar}

        {/* ── ФІНАЛ ДЛЯ ВИБУЛОГО ──
            Бункер зачинився без нього: жодного святкування на свою
            адресу, лише чесний результат і секрети всіх. */}
        {room.game_phase === "final" && (
          <>
            <div className="mt-6 rounded-3xl border-2 border-red-900 bg-gradient-to-b from-red-950/50 to-black p-8 text-center">
              <div className="text-7xl">☠️</div>

              <h1 className="mt-5 text-4xl font-black text-red-400 md:text-5xl">
                БУНКЕР ЗАЧИНИВСЯ БЕЗ ТЕБЕ
              </h1>

              <p className="mt-4 text-lg text-gray-400">
                Тебе вигнали, і місця в бункері дістались іншим. Ось хто
                залишився всередині.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {alivePlayers.map((player) => {
                const character = characters.find(
                  (item) => item.player_id === player.id
                );

                return (
                  <div
                    key={player.id}
                    className="anim-rise rounded-3xl border border-green-900 bg-gradient-to-br from-green-950/30 to-black p-6"
                  >
                    <div className="text-3xl font-black">
                      🏆 {player.name}
                    </div>

                    {character && (
                      <div className="mt-4 space-y-2 text-sm text-gray-300">
                        <div>🎂 {character.age} років</div>
                        <div>💼 {character.profession}</div>
                        <div>❤️ {character.health}</div>
                        <div>🧠 {character.skill}</div>
                        <div>🎒 {character.item}</div>
                        <div>😨 {character.phobia}</div>

                        <div className="border-t border-yellow-900/50 pt-3 text-yellow-400">
                          🔐 {character.secret}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-3xl border border-gray-800 bg-gray-950 p-6">
              <div className="text-sm uppercase tracking-wider text-gray-500">
                🔐 ХТО ЩО ПРИХОВУВАВ
              </div>

              <div className="mt-4 space-y-2">
                {players.map((player) => {
                  const character = characters.find(
                    (item) => item.player_id === player.id
                  );

                  if (!character) return null;

                  return (
                    <div
                      key={player.id}
                      className={`rounded-2xl border p-4 ${
                        player.is_alive
                          ? "border-green-900 bg-green-950/10"
                          : "border-gray-800 bg-gray-950"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black">
                          {player.is_alive ? "🏆" : "☠️"} {player.name}
                          {player.id === currentPlayer.id && (
                            <span className="ml-2 text-xs text-red-400">
                              (ти)
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          {player.is_alive ? "у бункері" : "зовні"}
                        </span>
                      </div>

                      <div className="mt-2 text-yellow-400">
                        🔐 {character.secret}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={returnToLobby}
              className="mt-8 w-full rounded-xl border border-gray-700 px-6 py-4 font-bold hover:bg-gray-900"
            >
              ← ПОВЕРНУТИСЯ В ЛОБІ
            </button>
          </>
        )}

        {room.game_phase !== "final" && (
        <>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-900 bg-red-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">☠️</span>
            <div>
              <div className="text-lg font-black text-red-400">
                ТИ ВИЛЕТІВ — РЕЖИМ ГЛЯДАЧА
              </div>
              <div className="text-sm text-gray-400">
                Дивишся гру, але не голосуєш і не виступаєш.
              </div>
            </div>
          </div>

          <button
            onClick={returnToLobby}
            className="rounded-xl border border-gray-700 px-5 py-3 text-sm font-bold hover:bg-gray-900"
          >
            ← ВИЙТИ В ЛОБІ
          </button>
        </div>

        {currentStage && (
          <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500">
                  ПОТОЧНИЙ РАУНД
                </div>
                <div className="mt-2 text-3xl font-black">
                  {currentStage.icon} {currentStage.title}
                </div>
                <div className="mt-1 text-gray-500">
                  Раунд {currentRound} · {phaseLabel}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black/40 px-6 py-4 text-center">
                <div className="text-xs uppercase tracking-widest text-gray-500">
                  БУНКЕР
                </div>
                <div className="mt-1 text-2xl font-black">
                  {alivePlayers.length} / {room.bunker_capacity}
                </div>
              </div>
            </div>
          </div>
        )}

        {room.game_phase === "defense" && (
          <div className="mt-6 rounded-3xl border border-blue-900 bg-blue-950/20 p-8 text-center">
            <div className="text-sm uppercase tracking-widest text-gray-500">
              ЗАРАЗ ГОВОРИТЬ
            </div>

            <div className="mt-4 text-4xl font-black">
              {currentSpeaker?.name ?? "Гравець"}
            </div>

            {speakerCharacter && (
              <div className="mt-2 text-sm text-gray-400">
                {speakerCharacter.profession} · {speakerCharacter.age} років
              </div>
            )}

            <div
              className={`mt-6 text-6xl font-black tabular-nums ${
                isPaused ? "text-amber-400" : ""
              }`}
            >
              {formatClock(timeLeft)}
            </div>

            {isPaused && (
              <div className="mt-3 font-black text-amber-400">
                ⏸️ Гру призупинив DM
              </div>
            )}
          </div>
        )}

        {room.game_phase === "voting" && (
          <div className="mt-6 rounded-3xl border border-purple-900 bg-purple-950/20 p-6">
            <div className="text-sm uppercase tracking-wider text-purple-500">
              🗳️ ГОЛОСУВАННЯ
            </div>
            <p className="mt-3 text-gray-400">
              Живі гравці зараз вирішують, хто наступний залишить бункер.
              Твій голос не враховується.
            </p>
          </div>
        )}

        {room.catastrophe && (
          <div className="mt-6 rounded-3xl border border-yellow-800 bg-yellow-950/20 p-6">
            <div className="text-xs uppercase tracking-wider text-yellow-600">
              ⚡ ЩО ВІДБУВАЄТЬСЯ
            </div>
            <div className="mt-2 text-3xl font-black text-yellow-400">
              {room.catastrophe}
            </div>
            <p className="mt-3 text-gray-300">
              {room.catastrophe_description}
            </p>
          </div>
        )}

        {room.game_message && (
          <div className="mt-6 rounded-3xl border border-sky-800 bg-sky-950/30 p-5">
            <div className="text-xs uppercase tracking-[0.25em] text-sky-400">
              📢 ОГОЛОШЕННЯ ВІД DM
            </div>
            <p className="mt-2 text-lg text-sky-100">{room.game_message}</p>
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-wider text-gray-500">
              👥 ХТО ЩЕ В ГРІ
            </div>
            <div className="text-sm text-gray-500">
              {alivePlayers.length} живих / {players.length}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => {
              const character = characters.find(
                (item) => item.player_id === player.id
              );

              const isSpeaker = currentSpeaker?.id === player.id;

              return (
                <div
                  key={player.id}
                  className={`rounded-2xl border p-4 ${
                    !player.is_alive
                      ? "border-red-950 bg-red-950/20 opacity-50"
                      : isSpeaker
                      ? "border-blue-600 bg-blue-950/20"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black">
                      {player.is_alive ? "🟢" : "☠️"} {player.name}
                    </span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                        player.is_alive
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-red-950 text-red-300"
                      }`}
                    >
                      {player.is_alive ? "у грі" : "вибув"}
                    </span>
                  </div>

                  {isSpeaker && (
                    <div className="mt-1 text-xs font-black text-blue-300">
                      🎤 говорить
                    </div>
                  )}

                  {character && (
                    <div className="mt-3 space-y-1.5 text-xs">
                      {stages.map((stage) => {
                        const revealed = currentRound >= stage.round;

                        return (
                          <div key={stage.round} className="flex items-start gap-2">
                            <span>{stage.icon}</span>
                            <span
                              className={
                                revealed
                                  ? currentRound === stage.round
                                    ? "font-bold text-red-200"
                                    : "text-gray-300"
                                  : "select-none text-gray-600 blur-[4px]"
                              }
                            >
                              {revealed
                                ? characterValue(character, stage.field)
                                : "████████ 🔒"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-xs text-gray-500">
            Повні картки інших гравців тобі не показуються — так само, як і
            живим учасникам.
          </p>
        </div>
        </>
        )}
      </div>
    </main>
  ) : null;

  const myRequests = requests.filter((item) => item.player_id === currentPlayer.id);
  const myPending = myRequests.find((item) => item.status === "pending");
  const myLastResolved = myRequests.find((item) => item.status !== "pending");
  const perkUsed = myRequests.some(
    (item) => item.type === "perk" && item.status === "approved"
  );

  const requestPanel = currentPlayer.is_alive ? (
    <div className="mt-6 rounded-3xl border border-purple-800 bg-purple-950/20 p-6">
      <div className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
        📨 НАПИСАТИ ВЕДУЧОМУ
      </div>

      {myLastResolved && (
        <div
          className={`mt-4 rounded-2xl border p-4 ${
            myLastResolved.status === "approved"
              ? "border-green-800 bg-green-950/30"
              : "border-red-900 bg-red-950/30"
          }`}
        >
          <div className="text-sm font-black">
            {myLastResolved.status === "approved"
              ? "✅ DM дозволив твій запит"
              : "❌ DM відхилив твій запит"}
          </div>
          <div className="mt-1 text-sm text-gray-400">«{myLastResolved.message}»</div>
          {myLastResolved.dm_reply && (
            <div className="mt-2 text-base font-bold text-sky-200">
              💬 DM: {myLastResolved.dm_reply}
            </div>
          )}
        </div>
      )}

      {myPending ? (
        <div className="mt-4 rounded-2xl border border-amber-700 bg-amber-950/30 p-4">
          <div className="font-black text-amber-300">⏳ Запит надіслано — чекаємо на DM</div>
          <div className="mt-1 text-sm text-gray-400">«{myPending.message}»</div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {requestTypes.map((type) => {
              const disabled = type.value === "perk" && (perkUsed || !myCharacter?.perk);

              return (
                <button
                  key={type.value}
                  onClick={() => setRequestType(type.value)}
                  disabled={disabled}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                    requestType === type.value
                      ? "border-purple-500 bg-purple-900/40"
                      : "border-gray-800 bg-black/40 hover:border-gray-600"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {type.icon} {type.label}
                  {type.value === "perk" && perkUsed && (
                    <span className="ml-2 text-xs text-gray-500">(використано)</span>
                  )}
                </button>
              );
            })}
          </div>

          {requestType === "perk" && myCharacter?.perk && !perkUsed && (
            <p className="mt-3 text-sm text-blue-300">⭐ {myCharacter.perk}</p>
          )}

          <textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            rows={3}
            placeholder="Напр.: Хочу попросити Максима пояснити, чому він взагалі потрібен бункеру"
            className="mt-4 w-full resize-none rounded-xl border border-gray-700 bg-black p-4 text-white outline-none focus:border-purple-500"
          />

          <button
            onClick={submitRequest}
            disabled={actionLoading || isPaused || !requestText.trim()}
            className="mt-3 rounded-xl bg-purple-600 px-6 py-3 font-black hover:bg-purple-500 disabled:opacity-40"
          >
            📨 НАДІСЛАТИ DM
          </button>
        </>
      )}
    </div>
  ) : null;

  if (spectatorView) {
    return spectatorView;
  }

  if (room.game_phase === "briefing") {
    return (
      <main
      key={`shake-${shakeKey}`}
      className={`min-h-screen bg-black text-white px-5 py-8 ${shakeClass}`}
    >
        <div className="mx-auto max-w-5xl">
          {sceneBar}

          <div className="text-center">
            <h1 className="mt-2 text-5xl font-black">☢️ БУНКЕР INWEB</h1>

            <p className="mt-4 text-gray-400">
              Ти вже знаєш, хто ти. Лишилось зрозуміти правила.
            </p>
          </div>

          {!dismissedRules && (
            <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-gray-800 bg-gray-950 p-7">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-red-400">
                🎬 ПРАВИЛА ГРИ
              </div>

              <div className="mt-5 space-y-3">
                {rulesIntro.map((line) => (
                  <p key={line} className="text-lg text-gray-200">
                    {line}
                  </p>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                {rulesSteps.map((step) => (
                  <div key={step.title} className="rounded-2xl border border-gray-800 bg-black/40 p-5">
                    <div className="font-black">
                      {step.icon} {step.title}
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{step.text}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setDismissedRules(true)}
                className="mt-6 w-full rounded-xl bg-red-600 px-6 py-4 font-black hover:bg-red-500"
              >
                ✅ Я ЗРОЗУМІВ — ПОКАЗАТИ КАРТКУ
              </button>
            </div>
          )}

          {myCharacter && (
            <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-red-900 bg-red-950/20 p-7">
              <div className="text-sm uppercase tracking-wider text-red-500">
                ТВОЯ ПОВНА КАРТКА
              </div>

              <div className="mt-2 text-3xl font-black">{currentPlayer.name}</div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-black/30 p-4">
                  🎂 {myCharacter.age} років
                </div>
                <div className="rounded-xl bg-black/30 p-4">
                  💼 {myCharacter.profession}
                </div>
                <div className="rounded-xl bg-black/30 p-4">
                  ❤️ {myCharacter.health}
                </div>
                <div className="rounded-xl bg-black/30 p-4">
                  🧠 {myCharacter.skill}
                </div>
                <div className="rounded-xl bg-black/30 p-4">
                  🎒 {myCharacter.item}
                </div>
                <div className="rounded-xl bg-black/30 p-4">
                  😨 {myCharacter.phobia}
                </div>
              </div>

              {myCharacter.perk && (
                <div className="mt-5 rounded-xl border border-blue-900 bg-blue-950/20 p-5">
                  <div className="text-xs uppercase tracking-wider text-blue-500">
                    ⭐ ТВОЯ ЗДІБНІСТЬ
                  </div>
                  <div className="mt-2 text-lg font-bold text-blue-300">
                    {myCharacter.perk}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-xl border border-yellow-900 bg-yellow-950/20 p-5">
                <div className="text-xs uppercase tracking-wider text-yellow-600">
                  🔐 ТВОЯ ТАЄМНИЦЯ
                </div>
                <div className="mt-2 text-yellow-400">{myCharacter.secret}</div>
              </div>

              <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950 p-5 text-center text-gray-500">
                ⏳ Чекаємо, поки Game Master почне гру...
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════════════════════════
   * PLAYER VOTING
   * ════════════════════════════════════════════════════════════ */

  if (room.game_phase === "voting") {
    const submittedVoters = new Set(votes.map((vote) => vote.voter_id));

    const alreadyVoted = submittedVoters.has(currentPlayer.id);

    const isThreatened = isTiebreak && tiedPlayerIds.includes(currentPlayer.id);

    return (
      <main
      key={`shake-${shakeKey}`}
      className={`min-h-screen bg-black text-white px-5 py-8 ${shakeClass}`}
    >
        <div className="mx-auto max-w-5xl">
          {sceneBar}

          <h1 className="mt-2 text-5xl font-black">
            {isTiebreak ? "⚖️ ПЕРЕГОЛОСУВАННЯ" : "🗳️ ГОЛОСУВАННЯ"}
          </h1>

          <p className="mt-3 text-gray-500">Раунд {currentRound}</p>

          {room.game_message && (
            <div className="mt-6 rounded-3xl border border-sky-800 bg-sky-950/30 p-5">
              <p className="text-lg text-sky-100">{room.game_message}</p>
            </div>
          )}

          {isTiebreak && (
            <div className="mt-6 rounded-3xl border border-yellow-800 bg-yellow-950/20 p-6">
              <div className="text-xl font-black text-yellow-400">⚠️ НІЧИЯ</div>

              <p className="mt-2 text-gray-400">
                Попереднє голосування завершилось нічиєю. Голосувати можуть тільки
                безпечні гравці.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {alivePlayers
                  .filter((player) => tiedPlayerIds.includes(player.id))
                  .map((player) => (
                    <span
                      key={player.id}
                      className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300"
                    >
                      {player.name}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {!currentPlayer.is_alive && (
            <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/30 p-6">
              <div className="text-xl font-black text-red-400">☠️ ТИ ВИЛЕТІВ</div>
              <p className="mt-2 text-gray-500">
                Ти більше не можеш брати участь у голосуванні.
              </p>
            </div>
          )}

          {currentPlayer.is_alive && isThreatened && (
            <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/30 p-6">
              <div className="text-xl font-black text-red-400">
                ⚠️ ТИ ПІД ЗАГРОЗОЮ
              </div>
              <p className="mt-2 text-gray-500">
                Ти кандидат на виліт, тому не можеш голосувати в переголосуванні.
              </p>
            </div>
          )}

          {alreadyVoted && currentPlayer.is_alive && !isThreatened && (
            <div className="mt-6 rounded-2xl border border-green-900 bg-green-950/20 p-5">
              <div className="font-bold text-green-400">✓ Твій голос прийнято</div>
              <p className="mt-1 text-sm text-gray-500">Чекаємо на інших гравців.</p>
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {votingTargets.map((player) => {
              const selected = selectedTarget === player.id;

              return (
                <button
                  key={player.id}
                  disabled={!canVote || alreadyVoted || actionLoading || isPaused}
                  onClick={() => submitVote(player.id)}
                  className={`rounded-2xl border p-6 text-left transition ${
                    selected
                      ? "border-red-500 bg-red-950/50"
                      : "border-gray-800 bg-gray-900 hover:border-gray-600"
                  } ${
                    !canVote || alreadyVoted || isPaused
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black">{player.name}</span>
                    {selected && <span className="text-red-500">✓</span>}
                  </div>

                  <div className="mt-3 text-sm text-gray-500">
                    {isTiebreak ? "Кандидат на виліт" : "Проголосувати"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════════════════════════
   * PLAYER RESULTS
   * ════════════════════════════════════════════════════════════ */

  if (room.game_phase === "results") {
    const result = getVoteResults();

    return (
      <main
      key={`shake-${shakeKey}`}
      className={`min-h-screen bg-black text-white px-5 py-8 ${shakeClass}`}
    >
        <div className="mx-auto max-w-5xl">
          {flashBanner}
          {sceneBar}

          <h1 className="mt-2 text-5xl font-black">📊 РЕЗУЛЬТАТИ</h1>

          <div className="mt-8 space-y-3">
            {[...alivePlayers]
              .sort(
                (a, b) =>
                  (result.counts[b.id] ?? 0) - (result.counts[a.id] ?? 0)
              )
              .map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-2xl border p-5 ${
                    result.leaders.includes(player.id)
                      ? "border-red-700 bg-red-950/30"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <div className="font-black">{player.name}</div>
                  <div className="text-3xl font-black">
                    {result.counts[player.id]}
                  </div>
                </div>
              ))}
          </div>

          {isManualElimination && (
            <div className="mt-8 rounded-2xl border border-yellow-800 bg-yellow-950/20 p-6">
              <div className="text-xl font-black text-yellow-400">
                👑 GAME MASTER ПРИЙМАЄ РІШЕННЯ
              </div>
              <p className="mt-2 text-gray-500">
                Хост зараз визначає, хто залишає бункер.
              </p>
            </div>
          )}

          <div className="mt-8 text-center text-gray-500">
            Чекаємо на рішення Game Master...
          </div>
        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════════════════════════
   * PLAYER DEFENSE
   * ════════════════════════════════════════════════════════════ */

  if (room.game_phase === "defense") {
    const isMyTurn = currentSpeaker?.id === currentPlayer.id;

    return (
      <main
      key={`shake-${shakeKey}`}
      className={`min-h-screen bg-black text-white px-5 py-8 ${shakeClass}`}
    >
        <div className="mx-auto max-w-5xl">
          {flashBanner}
          {sceneBar}

          <h1 className="mt-2 text-5xl font-black">🎤 ЗАХИСТ</h1>

          {room.game_message && (
            <div className="mt-6 rounded-3xl border border-sky-800 bg-sky-950/30 p-5">
              <p className="text-lg text-sky-100">{room.game_message}</p>
            </div>
          )}

          <div
            className={`mt-6 rounded-3xl border p-8 text-center ${
              isMyTurn
                ? "border-red-500/70 bg-gradient-to-b from-red-950/50 to-black shadow-[0_0_35px_rgba(239,68,68,0.12)]"
                : "border-gray-800 bg-gray-900"
            }`}
          >
            <div className="text-sm uppercase tracking-widest text-gray-500">
              ЗАРАЗ ГОВОРИТЬ
            </div>

            <div className="mt-4 text-4xl font-black md:text-5xl">
              {currentSpeaker?.name ?? "Гравець"}
            </div>

            <div
              className={`mt-8 text-7xl font-black tabular-nums ${
                isPaused ? "text-amber-400" : ""
              }`}
            >
              {formatClock(timeLeft)}
            </div>

            {isPaused && (
              <div className="mt-4 text-lg font-black text-amber-400">
                ⏸️ Таймер зупинено
              </div>
            )}

            {isMyTurn && !isPaused && (
              <div className="mt-5 text-lg font-black text-green-400">
                🔥 ЗАРАЗ ТВОЯ ЧЕРГА
              </div>
            )}
          </div>

          {myCharacter?.perk && (
            <div className="mt-6 rounded-2xl border border-blue-900 bg-blue-950/20 p-5">
              <div className="text-xs uppercase tracking-wider text-blue-500">
                ⭐ ТВОЯ ЗДІБНІСТЬ
              </div>
              <div className="mt-2 font-bold text-blue-300">
                {myCharacter.perk}
              </div>
              <p className="mt-2 text-xs text-blue-700">
                Свою особливу дію надсилай ведучому — він вирішить, як її
                відіграти.
              </p>
            </div>
          )}

          {myCharacter && (
            <div className="mt-6 rounded-2xl border border-yellow-900 bg-yellow-950/20 p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-yellow-600">
                  🔐 ТВІЙ СЕКРЕТ
                </div>
                <button
                  onClick={() => setSecretHidden((value) => !value)}
                  className="rounded-lg border border-yellow-900 px-3 py-1 text-xs font-bold text-yellow-500 hover:bg-yellow-950"
                >
                  {secretHidden ? "ПОКАЗАТИ" : "СХОВАТИ"}
                </button>
              </div>

              <div
                className={`mt-2 text-lg text-yellow-400 ${
                  secretHidden ? "select-none blur-[6px]" : ""
                }`}
              >
                {secretHidden ? "████████████████" : myCharacter.secret}
              </div>
            </div>
          )}

          {requestPanel}

          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-5 text-center text-gray-500">
            Game Master керує порядком виступів.
          </div>
        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════════════════════════
   * PLAYER REVEAL — картки характеристик
   * ════════════════════════════════════════════════════════════ */

  return (
    <main
      key={`shake-${shakeKey}`}
      className={`min-h-screen bg-black text-white px-5 py-8 ${shakeClass}`}
    >
      <div className="mx-auto max-w-6xl">
        <style dangerouslySetInnerHTML={{ __html: gameAnimations }} />
        {roundFlash}
        {flashBanner}
        {sceneBar}

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-5xl font-black md:text-6xl">
              РАУНД {currentRound}
            </h1>

            {currentStage && (
              <p className="mt-3 text-2xl text-gray-300">
                {currentStage.icon} {currentStage.title}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 px-5 py-4">
            <div className="text-xs text-gray-500">БУНКЕР</div>
            <div className="mt-1 text-2xl font-black">
              {alivePlayers.length} / {room.bunker_capacity}
            </div>
          </div>
        </div>

        {pauseBanner}
        {roundBanner}

        {room.game_message && (
          <div className="mt-6 rounded-3xl border border-sky-800 bg-sky-950/30 p-5">
            <div className="text-xs uppercase tracking-[0.25em] text-sky-400">
              📢 ОГОЛОШЕННЯ ВІД DM
            </div>
            <p className="mt-2 text-lg text-sky-100">{room.game_message}</p>
          </div>
        )}

        {room.catastrophe && (
          <div className="mt-6 rounded-3xl border border-yellow-800 bg-yellow-950/20 p-6">
            <div className="text-xs uppercase tracking-wider text-yellow-600">
              ⚡ ЩО ВІДБУВАЄТЬСЯ
            </div>
            <div className="mt-2 text-3xl font-black text-yellow-400">
              {room.catastrophe}
            </div>
            <p className="mt-3 text-gray-300">{room.catastrophe_description}</p>
          </div>
        )}

        {myCharacter && (
          <div className="mt-6 rounded-3xl border-2 border-red-500/70 bg-gradient-to-br from-red-950/50 via-gray-950 to-black p-6 shadow-[0_0_30px_rgba(239,68,68,0.12)] md:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-red-400">
                  ТВОЯ КАРТКА ПЕРСОНАЖА
                </div>
                <div className="mt-2 text-4xl font-black md:text-5xl">
                  {currentPlayer.name}
                </div>
              </div>

              <div className="w-fit rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-300">
                🎭 ТВОЯ КАРТКА
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stages.map((stage) => {
                const highlighted =
                  room.game_phase === "reveal" && currentRound === stage.round;

                return (
                  <div
                    key={stage.round}
                    className={`rounded-2xl border p-5 text-lg font-semibold ${
                      highlighted
                        ? "border-red-500 bg-red-500/10 shadow-[0_0_25px_rgba(239,68,68,0.18)]"
                        : "border-red-900/50 bg-black/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-widest">
                      <span className={highlighted ? "text-red-300" : "text-gray-500"}>
                        {stage.icon} {stage.title}
                      </span>
                      {highlighted && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                          НОВЕ
                        </span>
                      )}
                    </div>

                    <div className="mt-3 text-2xl font-black">
                      {characterValue(myCharacter, stage.field)}
                    </div>
                  </div>
                );
              })}
            </div>

            {myCharacter.perk && (
              <div className="mt-5 rounded-xl border border-blue-900 bg-blue-950/20 p-5">
                <div className="text-xs uppercase tracking-wider text-blue-500">
                  ⭐ ТВОЯ ЗДІБНІСТЬ
                </div>
                <div className="mt-2 font-bold text-blue-300">
                  {myCharacter.perk}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-xl border border-yellow-900 bg-yellow-950/20 p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-yellow-600">
                  🔐 ТВІЙ СЕКРЕТ
                </div>
                <button
                  onClick={() => setSecretHidden((value) => !value)}
                  className="rounded-lg border border-yellow-900 px-3 py-1 text-xs font-bold text-yellow-500 hover:bg-yellow-950"
                >
                  {secretHidden ? "ПОКАЗАТИ" : "СХОВАТИ"}
                </button>
              </div>

              <div
                className={`mt-2 text-lg text-yellow-400 ${
                  secretHidden ? "select-none blur-[6px]" : ""
                }`}
              >
                {secretHidden ? "████████████████" : myCharacter.secret}
              </div>

              <p className="mt-2 text-xs text-yellow-700">
                Це бачиш тільки ти. Інші дізнаються у фіналі — або коли хтось
                випросить це в DM.
              </p>
            </div>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-wider text-gray-500">
              👥 ІНШІ ГРАВЦІ
            </div>

            <button
              onClick={() => setCharactersExpanded((value) => !value)}
              className="rounded-lg border border-gray-800 px-3 py-1 text-xs font-bold text-gray-400 hover:bg-gray-900"
            >
              {charactersExpanded ? "ЗГОРНУТИ" : "ДЕТАЛЬНІШЕ"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {players.map((player) => {
              const character = characters.find(
                (item) => item.player_id === player.id
              );

              if (!character) return null;
              if (player.id === currentPlayer.id) return null;

              const isCurrentSpeaker = currentSpeaker?.id === player.id;

              return (
                <div
                  key={player.id}
                  className={`rounded-3xl border p-5 transition-colors ${
                    !player.is_alive
                      ? "border-red-950 bg-red-950/20 opacity-50"
                      : isCurrentSpeaker
                      ? "border-blue-600 bg-gradient-to-br from-blue-950/40 to-gray-950 shadow-[0_0_22px_rgba(37,99,235,0.15)]"
                      : "border-sky-900/70 bg-gradient-to-br from-sky-950/30 to-gray-950 shadow-[0_0_18px_rgba(14,165,233,0.05)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-black">{player.name}</div>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        player.is_alive
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-red-950 text-red-300"
                      }`}
                    >
                      {player.is_alive ? "У грі" : "Вибув"}
                    </span>
                  </div>

                  {isCurrentSpeaker && (
                    <div className="mt-2 text-xs font-black text-blue-300">
                      🎤 ЗАРАЗ ГОВОРИТЬ
                    </div>
                  )}

                  <div className="mt-4 grid gap-2.5 text-base">
                    {stages.map((stage) => {
                      const revealed = currentRound >= stage.round;
                      const isNew = currentRound === stage.round;

                      return (
                        <div
                          key={stage.round}
                          className={`rounded-xl border p-3 ${
                            revealed
                              ? isNew
                                ? "border-red-500/40 bg-red-500/10"
                                : "border-gray-800 bg-black/30"
                              : "border-gray-900 bg-black/20"
                          }`}
                        >
                          <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            {stage.icon} {stage.title}
                            {revealed && isNew && (
                              <span className="ml-2 text-red-400">НОВЕ</span>
                            )}
                          </div>

                          <div className="mt-1.5">
                            {revealed ? (
                              <span
                                className={
                                  isNew
                                    ? "font-bold text-red-200"
                                    : "font-medium text-gray-200"
                                }
                              >
                                {characterValue(character, stage.field)}
                              </span>
                            ) : (
                              <span className="select-none text-gray-500 blur-[4px]">
                                ██████████ 🔒
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {charactersExpanded && (
                    <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 text-sm text-gray-500">
                      <div>
                        ⭐ Здібність:{" "}
                        {character.perk ? (
                          <span className="text-blue-400">{character.perk}</span>
                        ) : (
                          <span>немає</span>
                        )}
                      </div>
                      <div>
                        🔐 Секрет:{" "}
                        <span className="select-none blur-[5px]">
                          ████████████
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {requestPanel}

        <div className="mt-10 rounded-2xl border border-gray-800 bg-gray-950 p-5 text-center text-gray-500">
          👑 Game Master{" "}
          <span className="font-bold text-gray-300">{room.host_name}</span> керує
          грою.
        </div>
      </div>
    </main>
  );
}
