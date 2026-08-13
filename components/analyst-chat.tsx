"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { analyzeEmitenAction } from "@/app/actions/analyze";
import { ROBOT_GREETING } from "@/lib/analyst/copy";
import { clsx } from "@/lib/format";
import { RobotAvatar } from "./robot";

type Msg = {
  id: string;
  role: "bot" | "user";
  text: string;
  ticker?: string;
};

export function AnalystChat({ tall = false }: { tall?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "greet", role: "bot", text: ROBOT_GREETING },
  ]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function send() {
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text: q };
    setMessages((m) => [...m, userMsg]);
    startTransition(async () => {
      const result = await analyzeEmitenAction(q);
      setMessages((m) => [
        ...m,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: result.text,
          ticker: result.found ? result.ticker : undefined,
        },
      ]);
    });
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <RobotAvatar size={52} />
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Robot analisa</p>
          <p className="font-display text-2xl italic leading-tight">Cuan Bot</p>
        </div>
      </div>
      <div
        ref={scroller}
        className={clsx("space-y-4 overflow-y-auto px-4 py-5", tall ? "min-h-[28rem] max-h-[70vh]" : "h-[28rem]")}
      >
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} />
        ))}
        {pending ? (
          <div className="flex items-end gap-3">
            <RobotAvatar size={36} />
            <div className="bubble-bot px-4 py-3 text-sm text-mute">
              <span className="typing-dots">Membaca chart, pasar global, dan komoditas</span>
            </div>
          </div>
        ) : null}
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ketik kode atau nama emiten, misalnya BBCA atau Telkom"
          className="min-w-0 flex-1 border border-line bg-black/40 px-4 py-3 text-base text-foreground outline-none placeholder:text-mute/80 focus:border-gold/50"
          maxLength={80}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="border border-gold/40 bg-gold/15 px-5 py-3 text-sm uppercase tracking-[0.16em] text-gold disabled:opacity-40"
        >
          Kirim
        </button>
      </form>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bubble-user max-w-[85%] px-4 py-3 text-base leading-7">{msg.text}</div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-3">
      <RobotAvatar size={36} />
      <div className="bubble-bot max-w-[90%] px-4 py-3 text-base leading-7 whitespace-pre-wrap">
        {msg.text}
        {msg.ticker ? (
          <p className="mt-3">
            <Link href={`/saham/${msg.ticker}`} className="text-gold hover:underline">
              Buka halaman {msg.ticker} →
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
