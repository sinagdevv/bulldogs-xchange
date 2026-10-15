# Bulldogs Xchange frontend

React, Vite, TypeScript, and React Router frontend for the existing `/api` REST backend.

```bash
npm install
npm run dev
```

Copy the repository-root `.env.example` to `.env.local` for local-only options. Fixture authentication and API data are disabled by default and are ignored in production builds even if their flags are set. Production authentication uses the public Supabase URL and publishable key; without them, protected routes fail closed.

Validation: `npm run lint`, `npm run typecheck`, and `npm run build`.
