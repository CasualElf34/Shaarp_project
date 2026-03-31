"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Download,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import type { Exhibitor, SortKey, SortDirection } from "@/lib/types";
import { downloadCSV, downloadXLSX } from "@/lib/export";

export function ExhibitorTable({ exhibitors }: { exhibitors: Exhibitor[] }) {
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
    { key: "categories", label: "Catégories" },
    { key: "pays", label: "Pays" },
    { key: "site_web", label: "Site web" },
    { key: "email", label: "Email" },
    { key: "telephone", label: "Tél." },
    { key: "linkedin", label: "LinkedIn" },
    { key: "twitter", label: "X / Twitter" },
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

            <div className="flex gap-2">
              <Button
                onClick={() => downloadCSV(sorted)}
                className="rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white hover:opacity-95"
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                onClick={() => downloadXLSX(sorted)}
                className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-95"
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
            </div>
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
                    <div className="flex items-center gap-2">
                      {exhibitor.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={exhibitor.logo}
                          alt=""
                          className="w-6 h-6 rounded object-contain flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      {exhibitor.nom || "—"}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top text-zinc-600 dark:text-zinc-300">
                    {exhibitor.stand || "—"}
                  </td>
                  <td className="px-5 py-4 align-top">
                    {exhibitor.categories ? (
                      <div className="flex flex-wrap gap-1">
                        {exhibitor.categories.split(",").map((cat, ci) => (
                          <Badge key={ci} className="rounded-full bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:hover:bg-fuchsia-500/15">
                            {cat.trim()}
                          </Badge>
                        ))}
                      </div>
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
                  <td className="px-5 py-4 align-top text-zinc-600 dark:text-zinc-300">
                    {exhibitor.email ? (
                      <a href={`mailto:${exhibitor.email}`} className="text-violet-600 hover:underline dark:text-violet-300">
                        {exhibitor.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-4 align-top text-zinc-600 dark:text-zinc-300">
                    {exhibitor.telephone || "—"}
                  </td>
                  <td className="px-5 py-4 align-top">
                    {exhibitor.linkedin ? (
                      <a href={exhibitor.linkedin} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline dark:text-violet-300">in</a>
                    ) : <span className="text-zinc-400 dark:text-zinc-500">—</span>}
                  </td>
                  <td className="px-5 py-4 align-top">
                    {exhibitor.twitter ? (
                      <a href={exhibitor.twitter} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline dark:text-violet-300">𝕏</a>
                    ) : <span className="text-zinc-400 dark:text-zinc-500">—</span>}
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
