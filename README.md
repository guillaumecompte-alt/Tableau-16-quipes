# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS


## Déploiement sur Cloudflare Workers

Cette application utilise Supabase. Les variables côté navigateur sont injectées au moment de la compilation Vite ; les variables côté serveur sont lues à l'exécution par le Worker.

### Variables de build

Dans les paramètres **Build variables** du projet Cloudflare Workers Builds, configurez :

- `VITE_SUPABASE_URL` — l'URL du projet Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — la clé publique/publishable de Supabase.

Après les avoir renseignées ou modifiées, relancez un build. Les variables `VITE_*` sont intégrées au bundle navigateur : les ajouter uniquement aux variables d'exécution ne suffit pas.

### Variables d'exécution du Worker

Dans **Workers & Pages → votre Worker → Settings → Variables and Secrets**, configurez aussi :

- `SUPABASE_URL` — l'URL du projet Supabase.
- `SUPABASE_PUBLISHABLE_KEY` — la clé publique/publishable de Supabase.

La configuration Nitro de ce dépôt demande à Wrangler de préserver les variables ordinaires configurées dans le tableau de bord lors des déploiements. Cela ne recrée pas des variables qui auraient déjà disparu : vérifiez leurs noms et leurs valeurs dans Cloudflare.

Ne placez pas de clé `service_role` ou de secret Supabase dans une variable `VITE_*`, dans ce dépôt, ni dans du code envoyé au navigateur.
