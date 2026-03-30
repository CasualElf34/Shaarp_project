"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState, useMemo, type FormEvent } from "react";
import type { UIMessage } from "ai";
import { useTheme } from "next-themes";
import {
  Search,
  Send,
  Download,
  Sparkles,
  MessageSquare,
  ArrowUpDown,
  ExternalLink,
  Building2,
  MapPin,
  Briefcase,
  Moon,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
  let match: RegExpExecArray | null;

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
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "exposants.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

function SoftBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge className="rounded-full border border-violet-200 bg-white text-violet-700 hover:bg-white dark:border-violet-500/30 dark:bg-zinc-900 dark:text-violet-300 dark:hover:bg-zinc-900">
      {children}
    </Badge>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 text-violet-600 dark:from-violet-500/15 dark:to-pink-500/15 dark:text-violet-300">
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
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
    { key: "site_web", label: "Site web" },
    { key: "description", label: "Description" },
  ];

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-zinc-100 p-5 dark:border-zinc-800">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Résultats
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Tableau interactif généré à partir des données extraites
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/15">
                {sorted.length} exposant{sorted.length > 1 ? "s" : ""}
              </Badge>

              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Filtrer..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 pl-9 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-violet-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
            </div>

            <Button
              onClick={() => downloadCSV(sorted)}
              className="rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white hover:opacity-95"
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger CSV
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-950">
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 transition hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
                      {sortKey === col.key && (
                        <span className="text-violet-500 dark:text-violet-300">
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sorted.map((exhibitor, i) => (
                <tr
                  key={i}
                  className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60"
                >
                  <td className="px-5 py-4 align-top font-semibold text-zinc-900 dark:text-zinc-100">
                    {exhibitor.nom || "—"}
                  </td>
                  <td className="px-5 py-4 align-top text-zinc-600 dark:text-zinc-300">
                    {exhibitor.stand || "—"}
                  </td>
                  <td className="px-5 py-4 align-top">
                    {exhibitor.secteur ? (
                      <Badge className="rounded-full bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:hover:bg-fuchsia-500/15">
                        {exhibitor.secteur}
                      </Badge>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top text-zinc-600 dark:text-zinc-300">
                    {exhibitor.pays || "—"}
                  </td>
                  <td className="px-5 py-4 align-top">
                    {exhibitor.site_web ? (
                      <a
                        href={exhibitor.site_web}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 hover:underline dark:text-violet-300 dark:hover:text-violet-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Visiter
                      </a>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="max-w-sm px-5 py-4 align-top text-zinc-500 dark:text-zinc-400">
                    <div className="line-clamp-3">
                      {exhibitor.description || "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Aucun résultat
              </h3>
              <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                Aucun exposant ne correspond à la recherche actuelle.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    setMounted(true);
  }, []);

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

    return all.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (e) => e.nom === item.nom && e.site_web === item.site_web
        )
    );
  }, [messages]);

  const uniqueCountries = useMemo(() => {
    return new Set(allExhibitors.map((e) => e.pays).filter(Boolean)).size;
  }, [allExhibitors]);

  const uniqueSectors = useMemo(() => {
    return new Set(allExhibitors.map((e) => e.secteur).filter(Boolean)).size;
  }, [allExhibitors]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input }],
    });

    setInput("");
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900 dark:bg-[#050506] dark:text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 py-5 lg:px-6">
        <header className="mb-5 rounded-[36px] border border-zinc-200 bg-white px-6 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_8px_24px_rgba(168,85,247,0.25)]">
                <Sparkles className="h-7 w-7" />
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <SoftBadge>Agent IA</SoftBadge>
                  <SoftBadge>Scraping</SoftBadge>
                  <SoftBadge>Tableau interactif</SoftBadge>
                  <SoftBadge>Export CSV</SoftBadge>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="ml-1 rounded-full border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {mounted && theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 lg:text-4xl">
                  Tout ce sur quoi vous perdiez du temps...
                  <br />
                  <GradientText>déjà prêt avec ExpoScan.</GradientText>
                </h1>

                <p className="mt-3 max-w-3xl text-base leading-8 text-zinc-600 dark:text-zinc-300">
                  Une interface élégante pour dialoguer avec l’agent IA, lancer
                  l’extraction d’exposants et exploiter immédiatement les données
                  dans un tableau interactif.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                icon={<Building2 className="h-5 w-5" />}
                label="Exposants"
                value={allExhibitors.length}
              />
              <StatCard
                icon={<MapPin className="h-5 w-5" />}
                label="Pays"
                value={uniqueCountries}
              />
              <StatCard
                icon={<Briefcase className="h-5 w-5" />}
                label="Secteurs"
                value={uniqueSectors}
              />
            </div>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="flex min-h-[740px] flex-col">
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
                        Conversation et pilotage de l’extraction
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
                          Parlez à l’agent
                        </h2>

                        <p className="mt-3 max-w-md text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                          Collez l’URL d’un salon pro ou donnez une consigne.
                          L’agent analysera la page et alimentera automatiquement
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
                          <div className="whitespace-pre-wrap leading-7">
                            {msg.role === "assistant"
                              ? getMessageText(msg).replace(/<exhibitors>[\s\S]*?<\/exhibitors>/g, "").trim() || "Extraction en cours..."
                              : getMessageText(msg)}
                          </div>
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
                        placeholder="Collez l’URL d’un salon ou donnez une consigne..."
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
                      Envoyer à l’agent
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex min-h-[740px] flex-col">
            <div className="flex-1">
              <ExhibitorTable exhibitors={allExhibitors} />
            </div>
          </section>
        </main>

        <footer className="mt-5">
          <Separator className="bg-zinc-200 dark:bg-zinc-800" />
          <div className="pt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
            ExpoScan AI — interface conversationnelle et tableau d’extraction
          </div>
        </footer>
      </div>
    </div>
  );
}