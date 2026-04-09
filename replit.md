# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

SmartDictate AI — a mobile voice notes & text transformation app (Expo/React Native) with an Express API backend, replicating the original web app at smartdictate-ai-812398831792.us-west1.run.app.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with expo-router file-based navigation
- **AI**: Gemini 2.5 Flash via @workspace/integrations-gemini-ai

## Artifacts

### API Server (`artifacts/api-server`)
Express 5 API with endpoints:
- `GET /api/health` — health check
- `POST /api/transcribe` — audio transcription via Gemini (accepts base64 audio, returns transcript + summary + action items)
- `POST /api/process` — text transformation via Gemini (accepts text + format + tone, returns processed result)
  - Formats: `transcript` (clean up), `minutes` (meeting minutes), `tasks` (task list), `email` (professional email)
  - Tones: `formal` (professional & polished), `informal` (friendly & conversational)

### Mobile App (`artifacts/mobile`)
Expo React Native app with:
- **Home screen** — note list with Compose + Record dual FABs
- **Record screen** — voice recording via expo-av, transcription via API, navigates to note detail after saving
- **Compose screen** — text input with:
  - Dictation button (mic recording → transcribe → append text with separator)
  - File import button (expo-document-picker → transcribe audio/video files → append)
  - 4 AI transformation formats (Clean Up, Minutes, Tasks, Email)
  - Tone selector (Formal / Informal with purple accent)
  - Character counter (20K limit), copy, clear
  - "Process with AI" and "Add to Result" buttons
- **Note detail** — AI result section, original input, copy-to-clipboard, reprocess panel with format + tone selectors, format/tone badges, action items
- **Data model**: Note has `id`, `title`, `transcript`, `summary`, `actionItems`, `duration`, `createdAt`, `outputFormat?`, `processedOutput?`, `tone?`
- **Persistence**: AsyncStorage (key: `@smartdictate_notes`)
- **Theme**: Dark slate (#020617) with indigo (#6366f1) primary and purple (#a855f7) accent
- **Android fix**: Uses string literal `"base64"` instead of `FileSystem.EncodingType.Base64` to avoid crash

### Mockup Sandbox (`artifacts/mockup-sandbox`)
Vite dev server for component previews on canvas.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
