# SHAARP Scraper IA

## Contexte du projet

**Challenge 48h — Exhibition Scraper Agent**

Cette demande provient du client **SHAARP** et constitue le sujet du challenge. Le projet est un exercice de hackathon sur 2 jours destiné à des équipes de développeurs juniors. L'objectif est de produire une application complète, même simple, et pas uniquement un enchaînement de prompts.

Le but : concevoir un agent IA conversationnel capable de scraper la liste des exposants d'un salon professionnel à partir d'une URL, puis d'afficher les résultats dans un tableau interactif téléchargeable.

## Sommaire

- [Installation](#installation)
- [Fonctionnalités détaillées](#fonctionnalités-détaillées)
  - [Chat conversationnel](#chat-conversationnel)
  - [Agent IA avec tools](#agent-ia-avec-tools)
  - [Streaming temps réel](#streaming-temps-réel)
  - [Tableau de résultats](#tableau-de-résultats)
  - [Export](#export)
- [Particularités techniques](#particularités-techniques)
  - [Stack imposée](#stack-imposée)
  - [Contraintes techniques](#contraintes-techniques)
- [Architecture](#architecture-du-projet)
- [Commandes](#commandes)
- [Usage](#usage)
- [URLs de test](#urls-de-test)
- [Notes de cadrage](#notes-de-cadrage)
- [Conclusion](#conclusion)

## Objectif pédagogique

Le projet vise à démontrer :
- une application fonctionnelle avec front et back
- une logique de conception claire
- une structuration du projet cohérente
- une UX conversationnelle

## Description

**SHAARP Scraper IA** est un agent IA qui :
- comprend l'URL fournie par l'utilisateur
- analyse la structure du site
- extrait une liste d'exposants
- affiche les résultats dans un tableau triable et filtrable
- propose un export CSV

## Particularités techniques

### Stack imposée

- `Next.js` (App Router)
- `Vercel AI SDK` (agent avec tools)
- `shadcn/ui` + `TailwindCSS`
- `Playwright` pour le scraping

## Fonctionnalités attendues

1. Chat conversationnel
   - interaction avec l'utilisateur
   - possibilité d'affiner les demandes

2. Agent IA avec tools
   - navigation web
   - analyse HTML
   - extraction structurée
   - gestion de la pagination

3. Streaming temps réel
   - affichage de la progression

4. Tableau de résultats
   - affichage structuré
   - tri et recherche

5. Export
   - CSV (possible extension vers XLSX)

## Données extraites

Le scraper cible notamment les informations suivantes :
- Nom
- Description
- Site web
- Logo
- Stand / emplacement
- Pays
- LinkedIn
- Twitter / X
- Catégories / tags
- Email
- Téléphone

## Contraintes techniques

- Scraper générique multi-sites
- Utilisation du LLM pour comprendre la structure de la page
- Rate limiting (1–2 secondes entre requêtes)
- Gestion des erreurs (timeout, anti-bot, etc.)

## URLs de test
... (83lignes restantes)
