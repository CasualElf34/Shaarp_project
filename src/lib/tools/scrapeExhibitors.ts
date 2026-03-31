import { chromium, Page, BrowserContext } from 'playwright';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { zodSchema } from 'ai';
import { extractionProcessSchema, singleExhibitorProcessSchema, Exhibitor } from '../schema';

const randomDelay = (min = 800, max = 1500) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min)) + min));

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 20000) {
          clearInterval(timer);
          resolve();
        }
      }, 120);
    });
  });
}

function findFirstHref(anchors: Array<{ href: string; text: string }>, pattern: RegExp): string | undefined {
  return anchors.find(({ href }) => pattern.test(href))?.href;
}

function findBestWebsite(anchors: Array<{ href: string; text: string }>, currentUrl: string): string | undefined {
  const currentOrigin = new URL(currentUrl).origin;
  return anchors
    .filter(({ href }) => /^https?:\/\//i.test(href))
    .filter(({ href }) => !/(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|youtu\.be|mailto:|tel:)/i.test(href))
    .find(({ href }) => {
      try {
        return new URL(href).origin !== currentOrigin;
      } catch {
        return true;
      }
    })?.href;
}

// ========================================
// Phase 1: Collect exhibitor links + pagination
// ========================================
async function collectExhibitorLinks(
  page: Page,
  baseUrl: string,
  onProgress: (msg: string) => void
): Promise<{ links: string[]; names: string[] }> {
  const allLinks: Set<string> = new Set();
  const allNames: string[] = [];
  let pageNum = 1;
  const maxPages = 20; // Safety limit

  while (pageNum <= maxPages) {
    onProgress(`📄 Parcours de la page ${pageNum}...`);

    await autoScroll(page);
    await randomDelay(1000, 2000);

    // Extract all links that look like exhibitor detail pages
    const { links, names } = await page.evaluate((base: string) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const result: { links: string[]; names: string[] } = { links: [], names: [] };

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        const text = (a as HTMLElement).innerText?.trim();

        // Heuristic: exhibitor detail pages typically contain "exhibitor" or "exposant" in URL
        // Or they are links inside a list/grid with short text (company names)
        if (
          href &&
          text &&
          text.length > 1 &&
          text.length < 150 &&
          !href.includes('#') &&
          !href.includes('javascript:') &&
          (
            href.includes('/exhibitor') ||
            href.includes('/exposant') ||
            href.includes('/company') ||
            href.includes('/sponsor') ||
            // Generic: same domain, looks like a detail page
            (href.startsWith(new URL(base).origin) && href.split('/').length > 4)
          )
        ) {
          result.links.push(href);
          result.names.push(text);
        }
      }
      return result;
    }, baseUrl);

    for (const link of links) {
      allLinks.add(link);
    }
    for (const name of names) {
      if (!allNames.includes(name)) allNames.push(name);
    }

    onProgress(`📄 Page ${pageNum}: ${allLinks.size} liens d'exposants trouvés au total`);

    // Try to find and click "Next" / pagination button
    const hasNext = await page.evaluate(() => {
      const nextSelectors = [
        'a[aria-label="Next"]',
        'button[aria-label="Next"]',
        'a:has-text("Next")',
        'button:has-text("Next")',
        'a:has-text("Suivant")',
        'button:has-text("Suivant")',
        '.pagination a.next',
        '.pagination .next a',
        'nav[aria-label="pagination"] a:last-child',
        '[class*="pagination"] [class*="next"]',
        'a[rel="next"]',
      ];

      for (const sel of nextSelectors) {
        try {
          const el = document.querySelector(sel) as HTMLElement;
          if (el && !el.hasAttribute('disabled') && el.offsetParent !== null) {
            el.click();
            return true;
          }
        } catch { /* selector might be invalid */ }
      }
      return false;
    });

    if (!hasNext) {
      onProgress(`✅ Fin de la pagination. ${allLinks.size} liens d'exposants récoltés sur ${pageNum} page(s).`);
      break;
    }

    pageNum++;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await randomDelay(1500, 2500);
  }

  return { links: Array.from(allLinks), names: allNames };
}

// ========================================
// Phase 2: Scrape individual exhibitor detail
// ========================================
async function scrapeExhibitorDetail(
  context: BrowserContext,
  url: string,
  fallbackName: string
): Promise<Exhibitor | null> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await randomDelay(800, 1500);

    const pageData = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());
      const main = document.querySelector('main') || document.querySelector('#content') || document.querySelector('article') || document.body;
      const text = (main?.innerText || document.body.innerText || '').substring(0, 40000);
      const anchors = Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: (a.textContent || '').trim().replace(/\s+/g, ' '),
      })).filter(({ href }) => href);
      return { text, anchors };
    });

    const anchorPreview = pageData.anchors.slice(0, 80).map((anchor) => `- ${anchor.text || '[link]'} › ${anchor.href}`).join('\n');
    const directWebsite = findBestWebsite(pageData.anchors, url);
    const directLinkedin = findFirstHref(pageData.anchors, /linkedin\.com/i);
    const directTwitter = findFirstHref(pageData.anchors, /(twitter\.com|x\.com)/i);
    const directEmail = findFirstHref(pageData.anchors, /^mailto:/i)?.replace(/^mailto:/i, '');
    const directPhone = findFirstHref(pageData.anchors, /^tel:/i)?.replace(/^tel:/i, '');

    if (!pageData.text || pageData.text.trim().length < 50) {
      return {
        name: fallbackName,
        website: directWebsite || '',
        booth: '',
        linkedin: directLinkedin || '',
        twitter: directTwitter || '',
        email: directEmail || '',
        phone: directPhone || '',
      };
    }

    const { object } = await generateObject({
      model: openai.chat('gpt-4.1-mini'),
      schema: zodSchema(singleExhibitorProcessSchema),
      prompt: `Voici le contenu d'une fiche exposant. TA MISSION : Extraire UNIQUEMENT les COORDONNÉES DE CONTACT (email, téléphone, site web, booth, réseaux sociaux).

IMPORTANT : Ne fournis que le nom, le site officiel, le numéro de stand, LinkedIn, Twitter/X, l'email et le téléphone. Si un champ n'existe pas, laisse-le vide.

Contenu visible :\n${pageData.text}\n\nLiens détectés sur la page :\n${anchorPreview}`,
    });

    return {
      name: object.exhibitor.name || fallbackName,
      website: object.exhibitor.website || directWebsite || '',
      booth: object.exhibitor.booth || '',
      linkedin: object.exhibitor.linkedin || directLinkedin || '',
      twitter: object.exhibitor.twitter || directTwitter || '',
      email: object.exhibitor.email || directEmail || '',
      phone: object.exhibitor.phone || directPhone || '',
    };
  } catch (error: any) {
    console.warn(`[detail] Erreur sur ${url}: ${error.message}`);
    return { name: fallbackName, website: url, booth: '', linkedin: '', twitter: '', email: '', phone: '' };
  } finally {
    await page.close();
  }
}

// ========================================
// Phase 3: Orchestrator (used for streaming)
// ========================================
export interface ScrapeProgressEvent {
  type: 'status' | 'progress' | 'exhibitor' | 'done' | 'error';
  message?: string;
  current?: number;
  total?: number;
  exhibitor?: Exhibitor;
}

export async function* scrapeExhibitorsStream(url: string): AsyncGenerator<ScrapeProgressEvent> {
  yield { type: 'status', message: `🚀 Lancement du navigateur...` };
  
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    yield { type: 'status', message: `🌐 Chargement de la page...` };

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await randomDelay(2000, 3000);

    // Phase 1: Collect links
    yield { type: 'status', message: `🔍 Recherche des liens d'exposants et navigation dans les pages...` };

    const statusMessages: string[] = [];
    const { links, names } = await collectExhibitorLinks(page, url, (msg) => {
      statusMessages.push(msg);
    });

    // Emit collected status messages
    for (const msg of statusMessages) {
      yield { type: 'status', message: msg };
    }

    // If we found exhibitor links, do deep scraping
    if (links.length > 0) {
      const total = Math.min(links.length, 200); // Safety cap at 200
      yield { type: 'status', message: `🔬 Deep scraping de ${total} fiches exposants...` };

      // Process in batches of 3 for parallelism
      const batchSize = 3;
      let processed = 0;

      for (let i = 0; i < total; i += batchSize) {
        const batch = links.slice(i, Math.min(i + batchSize, total));
        const batchNames = batch.map((_, idx) => names[i + idx] || `Exposant ${i + idx + 1}`);

        const results = await Promise.allSettled(
          batch.map((link, idx) => scrapeExhibitorDetail(context, link, batchNames[idx]))
        );

        for (const result of results) {
          processed++;
          if (result.status === 'fulfilled' && result.value) {
            yield {
              type: 'exhibitor',
              exhibitor: result.value,
              current: processed,
              total,
            };
          } else {
            yield { type: 'progress', current: processed, total, message: `⚠️ Échec sur une fiche` };
          }
        }

        yield { type: 'progress', current: processed, total, message: `Progression: ${processed}/${total}` };
        await randomDelay(300, 600);
      }

      yield { type: 'done', total: processed, message: `✅ Extraction terminée ! ${processed} exposants traités.` };

    } else {
      // Fallback: no detail links found, use LLM on the listing page text
      yield { type: 'status', message: `⚡ Aucun lien de détail trouvé. Extraction directe depuis la liste...` };

      const pageData = await page.evaluate(() => {
        document.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());
        const main = document.querySelector('main') || document.querySelector('#content') || document.body;
        return main.innerText.substring(0, 150000);
      });

      const { object } = await generateObject({
        model: openai.chat('gpt-4o-mini'),
        schema: zodSchema(extractionProcessSchema),
        prompt: `Voici le contenu d'un site de salon professionnel. 
TA MISSION : Extraire TOUS les exposants avec UNIQUEMENT leurs COORDONNÉES DE CONTACT (email, téléphone, site web, stand/booth, réseaux sociaux). 

IMPORTANT : Ignore totalement les descriptions, les slogans ou les présentations d'activités. Ne remplis que les champs de contact.`,
      });

      for (let i = 0; i < object.exhibitors.length; i++) {
        yield {
          type: 'exhibitor',
          exhibitor: object.exhibitors[i],
          current: i + 1,
          total: object.exhibitors.length,
        };
      }

      yield { type: 'done', total: object.exhibitors.length, message: `✅ Extraction terminée ! ${object.exhibitors.length} exposants trouvés.` };
    }

  } catch (error: any) {
    console.error("[scrapeExhibitors] Erreur critique:", error.message);
    yield { type: 'error', message: `❌ Erreur: ${error.message}` };
  } finally {
    await browser.close();
  }
}
