import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { scrapeExhibitorsStream, ScrapeProgressEvent } from '@/lib/tools/scrapeExhibitors';

export const maxDuration = 300; // 5 minutes for deep scraping

// Simple URL detection
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

export async function POST(req: Request) {
  const body = await req.json();
  
  const rawMessages = body.messages || [];
  const messages = rawMessages.map((m: any) => {
    if (m.content) return { role: m.role, content: m.content };
    if (m.prompt) return { role: m.role || 'user', content: m.prompt };
    if (m.parts) {
      const textParts = m.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text);
      return { role: m.role, content: textParts.join('') || '' };
    }
    return { role: m.role || 'user', content: '' };
  });

  // Get the last user message
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const url = lastUserMsg ? extractUrl(lastUserMsg.content) : null;

  // If URL detected, stream scrape progress
  if (url) {
    console.log(`[route] URL detected: ${url}, starting deep scrape stream...`);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of scrapeExhibitorsStream(url)) {
            const line = JSON.stringify(event) + '\n';
            controller.enqueue(encoder.encode(line));
          }
        } catch (error: any) {
          const errorEvent: ScrapeProgressEvent = { type: 'error', message: error.message };
          controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Scrape-Stream': 'true',
      },
    });
  }

  // No URL: just chat normally
  const result = streamText({
    model: openai.chat('gpt-4.1'),
    messages,
    system: `Tu es « Shaarp AI Scraper », agent d’extraction d’exposants pour des salons professionnels.
À partir d’une page de liste d’exposants d’un salon, tu dois renvoyer un tableau JSON d’objets avec UNIQUEMENT les champs :
name : nom exact de l’exposant
stand : numéro/code de stand ou null
sector : secteur/catégorie ou null
description : courte description ou null
url : l’URL de la fiche exposant sur le site du salon.

Règles :
url doit être l’URL du profil exposant hébergé sur le site du salon, jamais le site web officiel de l’entreprise.
Si tu trouves plusieurs URLs (profil salon + site corporate), mets uniquement l’URL du profil salon dans url.
N’ajoute un exposant que si tu as un name clair ET une url de profil salon.
Considère un exposant comme unique par (name, url) et supprime tous les doublons avant de répondre.
`,
  });

  return result.toTextStreamResponse();
}
