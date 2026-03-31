import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import Firecrawl from "@mendable/firecrawl-js";
import { z } from "zod";

export const ExhibitorSchema = z.object({
  nom: z.string(),
  description: z.string(),
  site_web: z.string(),
  logo: z.string(),
  stand: z.string().describe(
    "Emplacement complet : lieu, hall, pavillon, square, numéro de stand. Ex: 'Congress Square Stand CS96', 'Hall 5 Stand 5A12'"
  ),
  pays: z.string(),
  linkedin: z.string().describe(
    "URL LinkedIn de l'entreprise. Tout lien contenant linkedin.com. Ex: 'https://www.linkedin.com/company/example'"
  ),
  twitter: z.string().describe(
    "URL Twitter/X de l'entreprise. Tout lien contenant twitter.com ou x.com. Ex: 'https://x.com/example'"
  ),
  categories: z.string(),
  email: z.string(),
  telephone: z.string(),
});

export const ExhibitorArraySchema = z.object({
  exhibitors: z.array(ExhibitorSchema),
});

export async function extractExhibitorFromPage(
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
