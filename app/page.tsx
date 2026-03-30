"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState, useMemo, type FormEvent } from "react";
import type { UIMessage } from "ai";

interface Exhibitor {
  nom: string;
  stand: string;
  secteur: string;
  pays: string;
  site_web: string;
  description: string;
}

type SortDirection = "asc" | "desc" | null;
type SortKey = keyof Exhibitor;

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function parseExhibitors(text: string): Exhibitor[] {
  const regex = /<exhibitors>\s*([\s\S]*?)\s*<\/exhibitors>/g;
  const allExhibitors: Exhibitor[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        allExhibitors.push(...parsed);
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return allExhibitors;
}

function downloadCSV(exhibitors: Exhibitor[]) {
  const headers = ["Nom", "Stand", "Secteur", "Pays", "Site Web", "Description"];
  const rows = exhibitors.map((e) => [
    e.nom,
    e.stand,
    e.secteur,
    e.pays,
    e.site_web,
    e.description,
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((r) =>
      r.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "exposants.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ExhibitorTable({ exhibitors }: { exhibitors: Exhibitor[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [filter, setFilter] = useState("");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return exhibitors.filter((e) =>
      Object.values(e).some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [exhibitors, filter]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const va = (a[sortKey] ?? "").toLowerCase();
      const vb = (b[sortKey] ?? "").toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "nom", label: "Nom" },
    { key: "stand", label: "Stand" },
    { key: "secteur", label: "Secteur" },
    { key: "pays", label: "Pays" },
    { key: "site_web", label: "Site Web" },
    { key: "description", label: "Description" },
  ];

  return (
    <div className="mt-4 w-full">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {sorted.length} exposant{sorted.length > 1 ? "s" : ""}
          </span>
          <input
            type="text"
            placeholder="Filtrer..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => downloadCSV(sorted)}
          className="flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Télécharger CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer select-none px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((exhibitor, i) => (
              <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{exhibitor.nom}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{exhibitor.stand || "—"}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{exhibitor.secteur || "—"}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{exhibitor.pays || "—"}</td>
                <td className="px-4 py-3">
                  {exhibitor.site_web ? (
                    <a
                      href={exhibitor.site_web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Lien
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">{exhibitor.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-zinc-500">Aucun résultat</div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const allExhibitors = useMemo(() => {
    const all: Exhibitor[] = [];
    for (const msg of messages) {
      if (msg.role === "assistant") {
        const text = getMessageText(msg);
        all.push(...parseExhibitors(text));
      }
    }
    return all;
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ role: "user", parts: [{ type: "text", text: input }] });
    setInput("");
  }

  function renderMessageContent(msg: UIMessage) {
    const text = getMessageText(msg);
    // Remove exhibitor JSON blocks from display, show table instead
    const cleaned = text.replace(/<exhibitors>[\s\S]*?<\/exhibitors>/g, "").trim();
    const exhibitors = parseExhibitors(text);
    return (
      <>
        {cleaned && (
          <div className="whitespace-pre-wrap">{cleaned}</div>
        )}
        {exhibitors.length > 0 && <ExhibitorTable exhibitors={exhibitors} />}
      </>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full bg-zinc-50 dark:bg-black font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-lg">
            E
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ExpoScan AI
            </h1>
            <p className="text-xs text-zinc-500">
              Extraction d&apos;exposants de salons professionnels
            </p>
          </div>
          {allExhibitors.length > 0 && (
            <button
              onClick={() => downloadCSV(allExhibitors)}
              className="ml-auto flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Tout exporter ({allExhibitors.length})
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Bienvenue sur ExpoScan AI
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-6">
                Collez l&apos;URL d&apos;un salon professionnel et je vais extraire la liste de tous les exposants pour vous.
              </p>
              <div className="flex flex-col gap-2 text-sm text-zinc-400">
                <span>Exemples :</span>
                <code className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-300">
                  Extrais les exposants de https://example-salon.com/exhibitors
                </code>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {msg.role === "assistant"
                  ? renderMessageContent(msg)
                  : <div className="whitespace-pre-wrap">{getMessageText(msg)}</div>
                }
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-zinc-500">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                  </div>
                  <span className="text-sm">Analyse en cours...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-sm">
        <form
          onSubmit={handleSubmit}
          className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Collez l'URL d'un salon ou posez une question..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
