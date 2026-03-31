"use client";

import { useRef, useEffect, useState, useMemo, useCallback, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { isToolUIPart, getToolName } from "ai";
import { Search, Send, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToolCallIndicator } from "@/components/ui-parts";

import type { Exhibitor } from "@/lib/types";
import { getMessageText, parseExhibitors } from "@/lib/parsers";

export function useChatExhibitors() {
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "streaming" || status === "submitted";

  const allExhibitors = useMemo(() => {
    const seen = new Set<string>();
    const all: Exhibitor[] = [];
    for (const msg of messages) {
      if (msg.role === "assistant") {
        const text = getMessageText(msg);
        for (const ex of parseExhibitors(text)) {
          const key = ex.nom.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            all.push(ex);
          }
        }
      }
    }
    return all;
  }, [messages]);

  return { messages, sendMessage, isLoading, allExhibitors };
}

export function ChatPanel({
  messages,
  sendMessage,
  isLoading,
}: {
  messages: UIMessage[];
  sendMessage: (msg: { role: "user"; parts: { type: "text"; text: string }[] }) => void;
  isLoading: boolean;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      sendMessage({ role: "user", parts: [{ type: "text", text: input }] });
      setInput("");
    },
    [input, isLoading, sendMessage]
  );

  function renderMessageContent(msg: UIMessage) {
    return (
      <>
        {msg.parts.map((part, idx) => {
          if (part.type === "text") {
            const cleaned = part.text.replace(/<exhibitors>[\s\S]*?<\/exhibitors>/g, "").trim();
            if (!cleaned) return null;
            return <div key={idx} className="whitespace-pre-wrap text-sm">{cleaned}</div>;
          }
          if (isToolUIPart(part)) {
            const name = getToolName(part);
            return (
              <ToolCallIndicator
                key={idx}
                toolName={name}
                state={part.state}
                input={part.input}
              />
            );
          }
          return null;
        })}
      </>
    );
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-[36px] border border-zinc-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-gradient-to-br from-violet-100 to-pink-100 text-violet-600 dark:from-violet-500/15 dark:to-pink-500/15 dark:text-violet-300">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                Agent IA
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Conversation et pilotage de l&apos;extraction
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="space-y-5">
            {messages.length === 0 && (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-violet-100 to-pink-100 text-violet-600 dark:from-violet-500/15 dark:to-pink-500/15 dark:text-violet-300">
                  <MessageSquare className="h-9 w-9" />
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Parlez à l&apos;agent
                </h2>

                <p className="mt-3 max-w-md text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                  Collez l&apos;URL d&apos;un salon pro ou donnez une consigne.
                  L&apos;agent analysera la page et alimentera automatiquement
                  le tableau à droite.
                </p>

                <div className="mt-8 space-y-3 text-left">
                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    Extrais les exposants de https://www.mwcbarcelona.com/exhibitors
                  </div>
                  <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    Récupère le nom, le pays, le site web et le secteur
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-[28px] px-5 py-4 shadow-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {msg.role === "assistant"
                    ? renderMessageContent(msg)
                    : <div className="whitespace-pre-wrap leading-7 text-sm">{getMessageText(msg)}</div>
                  }
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                    <div className="flex gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-pink-400 animate-bounce" />
                    </div>
                    <span className="text-sm">Analyse en cours...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Collez l'URL d'un salon ou donnez une consigne..."
                disabled={isLoading}
                className="h-12 rounded-[22px] border-zinc-200 bg-zinc-50 pl-11 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-violet-400 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-12 rounded-[22px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white hover:opacity-95"
            >
              <Send className="mr-2 h-4 w-4" />
              Envoyer à l&apos;agent
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
