import { openai } from "@ai-sdk/openai";
import {
  streamText,
  generateObject,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
  type ModelMessage,
} from "ai";
import Firecrawl from "@mendable/firecrawl-js";
import { z } from "zod";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const maxDuration = 300;

// ---------- Server-side state (per-request via closure, persisted across steps) ----------
let urlQueue: string[] = [];
let urlQueueIndex = 0;
const processedUrls = new Set<string>();
const processedNames = new Set<string>();
let totalExtracted = 0;

// Schema for a single exhibitor (used by the extraction LLM)
const ExhibitorSchema = z.object({
  nom: z.string(),
  description: z.string(),
  site_web: z.string(),
  logo: z.string(),
  stand: z.string().describe("Emplacement complet : lieu, hall, pavillon, square, numéro de stand. Ex: 'Congress Square Stand CS96', 'Hall 5 Stand 5A12'"),
  pays: z.string(),
  linkedin: z.string().describe("URL LinkedIn de l'entreprise. Tout lien contenant linkedin.com. Ex: 'https://www.linkedin.com/company/example'"),
  twitter: z.string().describe("URL Twitter/X de l'entreprise. Tout lien contenant twitter.com ou x.com. Ex: 'https://x.com/example'"),
  categories: z.string(),
  email: z.string(),
  telephone: z.string(),
});

const ExhibitorArraySchema = z.object({
  exhibitors: z.array(ExhibitorSchema),
});

// ---------- Server-side extraction: scrape + LLM parse in one shot ----------
async function extractExhibitorFromPage(
  firecrawl: Firecrawl,
  url: string
): Promise<z.infer<typeof ExhibitorSchema> | null> {
  try {
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ["markdown"],
      waitFor: 3000,
      onlyMainContent: true,
    });

    const markdown = scrapeResult.markdown ?? "";
    if (!markdown || markdown.length < 50) return null;

    const content =
      markdown.length > 6000 ? markdown.substring(0, 6000) : markdown;

    const { object } = await generateObject({
      model: openai("gpt-4.1-nano"),
      schema: ExhibitorArraySchema,
      prompt: `Extrais les données de cet exposant depuis le contenu markdown ci-dessous.
Règles :
- site_web = site OFFICIEL de l'entreprise (PAS l'URL du salon, PAS un réseau social)
- stand = emplacement COMPLET tel qu'affiché sur la page. Inclure le lieu, hall, pavillon, square, numéro de stand, etc. Exemples valides : "Hall 3 - Stand 3K30", "Congress Square Stand CS96", "Hall 5 Stand 5A12", "Fira Gran Via, Hall 2, 2D40", "South Village SV10". Copie EXACTEMENT le texte de localisation trouvé.
- RÉSEAUX SOCIAUX — Détecte les liens par leur domaine :
  * linkedin = tout lien contenant "linkedin.com" → champ linkedin
  * twitter = tout lien contenant "twitter.com" ou "x.com" → champ twitter
  * facebook, instagram, youtube, tiktok, etc. → ignore
  Les liens réseaux sociaux ne sont PAS des sites web officiels.
- Si un champ est introuvable, retourne ""
- Retourne exactement 1 exposant dans le tableau

Contenu:
${content}`,
    });

    const ex = object.exhibitors[0];
    if (!ex || !ex.nom) return null;
    return ex;
  } catch {
    return null;
  }
}

// Trim conversation to prevent context overflow: keep system context + first user msg + last few exchanges
function trimMessages(msgs: ModelMessage[], keepLast: number = 4): ModelMessage[] {
  if (msgs.length <= keepLast + 1) return msgs;
  // Keep the first message (user's initial request) + the last N messages
  return [msgs[0], ...msgs.slice(-keepLast)];
}

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: UIMessage[] };

  const allModelMessages = await convertToModelMessages(messages);
  // Trim to avoid context overflow from accumulated tool results
  const modelMessages = trimMessages(allModelMessages, 6);

  // Reset state on fresh conversations (first message), preserve across continuation
  if (messages.length <= 2) {
    urlQueue = [];
    urlQueueIndex = 0;
    processedUrls.clear();
    processedNames.clear();
    totalExtracted = 0;
  }

  const firecrawl = new Firecrawl({
    apiKey: process.env.FIRECRAWL_API_KEY!,
  });

  const result = streamText({
    model: openai("gpt-4.1"),
    maxOutputTokens: 16000,
    system: `Tu es un agent IA spécialisé dans l'extraction EXHAUSTIVE de listes d'exposants de salons professionnels.

## ARCHITECTURE
L'extraction est faite CÔTÉ SERVEUR. Tu ne vois jamais le markdown brut. Tu pilotes simplement le processus.

## WORKFLOW OBLIGATOIRE
1. **map_site** → Stocke les URLs côté serveur, te donne le total
2. **process_batch** → Extrait automatiquement les exposants (scrape + LLM côté serveur). Retourne directement le JSON prêt à l'emploi
3. Émets le JSON reçu dans un bloc <exhibitors>[...]</exhibitors>
4. Appelle **process_batch** à nouveau → BOUCLE jusqu'à done=true

## RÈGLES CRITIQUES
- Appelle process_batch EN BOUCLE. NE T'ARRÊTE JAMAIS tant que done≠true
- Le dédoublonnage est automatique (par URL et par nom)
- Chaque process_batch te renvoie ~5 exposants déjà formatés. Émets-les dans <exhibitors> et continue
- Si un lot retourne 0 résultat, continue au lot suivant
- Affiche : "Lot X - Y extraits (Z restants)" après chaque bloc
- Fin : "FIN DU SCRAPING : [totalExtracted] exposants trouvés au total."

## FORMAT DE SORTIE
Quand process_batch retourne des exhibitors, émets immédiatement :
<exhibitors>
[...le JSON retourné par process_batch...]
</exhibitors>

Puis appelle process_batch pour le lot suivant sans tarder.`,
    messages: modelMessages,
    tools: {
      map_site: {
        description:
          "Découvre les URLs d'un site web. Les URLs sont STOCKÉES côté serveur. Retourne seulement le total et un aperçu. Utilise ensuite process_batch pour extraire les exposants par lots.",
        inputSchema: z.object({
          url: z.string().url().describe("L'URL de base du site à mapper"),
          search: z
            .string()
            .optional()
            .describe("Mot-clé optionnel pour filtrer les URLs"),
        }),
        execute: async ({ url, search }: { url: string; search?: string }) => {
          await sleep(2000);
          try {
            const mapResult = await firecrawl.map(url, {
              search,
              limit: 5000,
            });

            const links = mapResult.links ?? [];
            // Deduplicate and store server-side
            const newUrls = links
              .map((l) => l.url)
              .filter((u) => !processedUrls.has(u));
            urlQueue = [...urlQueue, ...newUrls];

            return {
              success: true as const,
              totalFound: links.length,
              newUrls: newUrls.length,
              alreadyQueued: links.length - newUrls.length,
              preview: newUrls.slice(0, 5),
              message: `${newUrls.length} nouvelles URLs ajoutées à la file. Utilise process_batch pour extraire les exposants.`,
            };
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Erreur inconnue";
            return { success: false as const, error: message };
          }
        },
      },
      process_batch: {
        description:
          "Extrait les exposants du prochain lot d'URLs. Fait TOUT le travail côté serveur (scrape + extraction LLM) et retourne directement le JSON des exposants. Appelle cet outil EN BOUCLE jusqu'à done=true. Le résultat est prêt à être émis dans un bloc <exhibitors>.",
        inputSchema: z.object({
          batchSize: z
            .number()
            .optional()
            .describe("Nombre d'URLs à traiter (défaut: 5, max: 10)"),
        }),
        execute: async ({ batchSize }: { batchSize?: number }) => {
          const size = Math.min(batchSize ?? 5, 10);
          const batch = urlQueue.slice(urlQueueIndex, urlQueueIndex + size);
          urlQueueIndex += batch.length;

          const results: z.infer<typeof ExhibitorSchema>[] = [];
          const errors: string[] = [];

          for (const url of batch) {
            if (processedUrls.has(url)) continue;
            processedUrls.add(url);

            await sleep(1500);
            const exhibitor = await extractExhibitorFromPage(firecrawl, url);

            if (exhibitor) {
              // Deduplicate by name
              const nameKey = exhibitor.nom.toLowerCase().trim();
              if (!processedNames.has(nameKey)) {
                processedNames.add(nameKey);
                results.push(exhibitor);
                totalExtracted++;
              }
            } else {
              errors.push(url);
            }
          }

          const remaining = Math.max(0, urlQueue.length - urlQueueIndex);

          return {
            exhibitors: results,
            extracted: results.length,
            errors: errors.length,
            totalExtracted,
            remaining,
            batchNumber: Math.ceil(urlQueueIndex / size),
            done: remaining === 0 && batch.length > 0,
            message: remaining > 0
              ? `Lot traité : ${results.length} exposants extraits. ${remaining} URLs restantes. Appelle process_batch pour continuer.`
              : `Terminé ! ${totalExtracted} exposants extraits au total.`,
          };
        },
      },
      scrape_page: {
        description:
          "Scrape une seule page web (max 5000 chars). Utilise uniquement pour l'exploration initiale ou les pages de liste. Pour les fiches exposants, préfère process_batch.",
        inputSchema: z.object({
          url: z.string().url().describe("L'URL de la page à scraper"),
        }),
        execute: async ({ url }: { url: string }) => {
          await sleep(500);
          try {
            const scrapeResult = await firecrawl.scrape(url, {
              formats: ["markdown"],
              waitFor: 3000,
              onlyMainContent: true,
            });

            const markdown = scrapeResult.markdown ?? "";
            const truncated =
              markdown.length > 5000
                ? markdown.substring(0, 5000) + "\n\n[...tronqué]"
                : markdown;

            return {
              success: true as const,
              content: truncated,
              url,
            };
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Erreur inconnue";
            return { success: false as const, error: message, url };
          }
        },
      },
    },
    stopWhen: stepCountIs(200),
    maxRetries: 3,
  });

  return result.toUIMessageStreamResponse();
}
