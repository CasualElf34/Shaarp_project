import { openai } from "@ai-sdk/openai";
import { streamText, stepCountIs } from "ai";
import FirecrawlApp from "@mendable/firecrawl-js";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const firecrawl = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY!,
  });

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `Tu es un assistant spécialisé dans l'extraction de listes d'exposants de salons professionnels.

Quand l'utilisateur te donne une URL d'un salon professionnel, utilise l'outil scrape_exhibitors pour extraire le contenu de la page.
Ensuite, analyse le contenu extrait pour identifier les exposants et retourne les résultats au format JSON structuré.

Tu dois toujours répondre en français.

Quand tu trouves des exposants, retourne TOUJOURS un bloc JSON avec ce format exact (encadré par des balises <exhibitors> et </exhibitors>):

<exhibitors>
[
  {
    "nom": "Nom de l'entreprise",
    "stand": "Numéro de stand si disponible",
    "secteur": "Secteur d'activité si disponible",
    "pays": "Pays si disponible",
    "site_web": "URL du site web si disponible",
    "description": "Description courte si disponible"
  }
]
</exhibitors>

Si la page contient un lien vers la liste complète des exposants, utilise l'outil pour naviguer vers cette page aussi.
Si le contenu est paginé, essaye de récupérer plusieurs pages.
Sois exhaustif dans l'extraction.`,
    messages,
    tools: {
      scrape_exhibitors: {
        description:
          "Scrape le contenu d'une page web d'un salon professionnel pour extraire la liste des exposants. Utilise cet outil quand l'utilisateur fournit une URL.",
        inputSchema: z.object({
          url: z.string().url().describe("L'URL de la page à scraper"),
        }),
        execute: async ({ url }: { url: string }) => {
          try {
            const scrapeResult = await firecrawl.scrape(url, {
              formats: ["markdown"],
            });

            const markdown = scrapeResult.markdown ?? "";
            const truncated =
              markdown.length > 30000
                ? markdown.substring(0, 30000) + "\n\n[... contenu tronqué]"
                : markdown;

            return {
              success: true as const,
              content: truncated,
              url: url,
            };
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Erreur inconnue";
            return { success: false as const, error: message };
          }
        },
      },
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
