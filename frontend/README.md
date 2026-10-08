# Bulldogs Xchange frontend

React, Vite, TypeScript, and React Router frontend for the existing `/api` REST backend.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` for local-only options. Fixture authentication and API data are disabled by default and are ignored in production builds even if their flags are set. Production authentication is supplied through the `window.bulldogsAuth0` bridge; without it, protected routes fail closed.

Validation: `npm run lint`, `npm run typecheck`, and `npm run build`.
