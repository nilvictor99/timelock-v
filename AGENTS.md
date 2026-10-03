# TimeLock-v — Guía para agentes

## Qué es
Aplicación web de gestión y control total del tiempo personal para adultos 18+.
Convierte el tiempo en herramienta motivadora con actividades programadas con hora exacta, temporizador regresivo real, puntos por categoría, recompensas, cadena diaria, modo viaje, sugerencias IA y exportación.

**Objetivo**: eliminar desperdicio de tiempo, maximizar progreso y proteger foco.

## Stack tecnológico
- Next.js 14 App Router + React 18 + TypeScript
- Tailwind CSS + shadcn/ui style
- PostgreSQL 14+ con cliente `pg` (sin ORM)
- Sistema de migraciones/seeders estilo Laravel
- Autenticación propia con sesiones en DB, cookies HttpOnly
- Bcryptjs para passwords
- date-fns, recharts, zod, lucide-react
- Docker opcional

## Arquitectura de alto nivel
```
src/app/              App Router, páginas, API routes
src/components/       UI reutilizable + dashboard
src/lib/              Cliente PostgreSQL (pg), repos, auth, utilidades, i18n, AI
database/
  migrations/         Migraciones SQL con sección UP y DOWN
  seeders/            Seeders TypeScript para datos iniciales
public/               uploads de avatares
```
- Middleware protege `/dashboard/*` y `/onboarding/*` con cookie `timelock_session`.
- Layout raíz provee ThemeProvider y I18nProvider. Locale desde cookie `timelock_locale`.
- API routes bajo `/api/*` validan sesión con `requireUser()`.

## Base de datos: migraciones estilo Laravel
- Sin Prisma/ORM. PostgreSQL directo vía `pg` Pool en `src/lib/db.ts`.
- Migraciones SQL en `database/migrations/NNNNN_nombre.sql` con `-- DOWN` para rollback.
- Seeders TypeScript en `database/seeders/NNNNN_nombre.ts` con `export default async function`.
- Control de estado en tablas `_migrations` y `_seeders`.

Comandos:
```bash
tl migrate [--seed]        # aplicar pendientes (+ sembrar con -s)
tl status                  # estado en tabla (aliases: st)
tl rollback [N] [--steps]  # revertir N lotes (predeterminado 1, alias: rb)
tl fresh [--seed]          # drop de todo + re-migrar (pide confirmación, alias: f)
tl seed                    # ejecutar seeders pendientes
tl check                   # diagnosticar conexión PostgreSQL
tl make:migration <nombre> # genera 00NNN_nombre.sql (UP/DOWN) con numeración automática
tl make:seeder <nombre>    # genera 00NNN_nombre.ts con plantilla
tl help                    # ayuda completa
```

El CLI `tl` está en `scripts/tl.ts` (lanzador `bin/tl`, instalado global con `npm link`).
Reutiliza `migration-runner.ts`/`seeder-runner.ts`; solo ejecuta la sección UP de cada
migración (la sección `-- DOWN` es solo para `tl rollback`). Fallback/CI en `npm run db:*`.

Los `npm run db:*` siguen disponibles y equivalentes:
`db:migrate`, `db:rollback`, `db:status`, `db:seed`, `db:refresh`.

## Modelos (tablas PostgreSQL)
- **users**: perfil, onboarding, modo operación SYNCHRONOUS/FREE, tema, idioma, preferencias IA, streaks, pause.
- **categories**: nombre por usuario, color, puntos/hora.
- **activities**: título, date, startAt, endAt, status PLANNED/ACTIVE/COMPLETED/MISSED/SKIPPED, points, isFree.
- **rewards**: título, cost, redeemedAt.
- **sessions**: tokenHash, expiresAt.
- **qr_login_tokens**: token de un solo uso 10 min.
- **suggestions**: sugerencias generadas por reglas o IA.

Relaciones: User 1—N Activities, Categories, Rewards, Sessions.

## Acceso a datos (`src/lib/data.ts`)
Funciones exportadas por dominio:
- `findUserByEmail`, `findUserById`, `createUserWithDefaults`, `updateUser`, `deleteUser`, `incrementUserPoints`
- `findCategoriesByUser`, `findCategoryByIdAndUser`
- `findActivitiesByUser`, `findActivitiesByUserRange`, `createActivity`, `updateActivity`, `deleteActivityByIdAndUser`
- `findRewardsByUser`, `createReward`
- `createManySuggestions`, `findRecentSuggestions`
- `findSessionWithUser`, `createSessionRow`, `deleteSessionByTokenHash`, `deleteSessionsByUser`
- `findQrTokenByHash`, `createQrToken`, `consumeQrToken`
- Helpers: `query`, `queryOne`, `queryMany`, `transaction`, `mapRow`, `mapRows`, `buildUpdate`

Las claves en `buildUpdate`/`updateUser` se pasan en camelCase; se convierten a snake_case internamente.

## Páginas principales
- `/` landing pública
- `/login`, `/register`
- `/onboarding` configuración inicial nombre, zona horaria, idioma, modo
- `/dashboard` resumen día/semana
- `/dashboard/profile` perfil, avatar, QR login
- `/dashboard/settings` tema, idioma, modo operación, Modo Pausa
- `/dashboard/stats` estadísticas

## API esencial
Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/qr` y `POST /api/auth/qr-login`

Datos:
- `GET/POST/PATCH/DELETE /api/bootstrap` carga/crea/actualiza actividades, perfil, onboarding
- `GET /api/export` exporta agenda CSV
- `POST /api/profile/avatar` subida avatar JPG/PNG/WebP ≤5MB
- `POST /api/ai/test-connection` prueba clave IA sin persistir

Todo filtrado por `userId` del usuario autenticado.

## Comandos de desarrollo
```bash
bash scripts/start.sh          # local con PostgreSQL, menú dev/prod/limpio
bash scripts/start-docker.sh   # Docker Compose
npm run dev                    # desarrollo directo
npm run build && npm start     # producción
tl migrate                     # aplicar migraciones (cliente DB principal)
tl seed                        # seed inicial
bash scripts/clean.sh          # limpiar artefactos locales
```
Requisitos: Node 20+, PostgreSQL 14+ o Docker.

## Convenciones de código
- App Router, Server Components por defecto, Client Components con `'use client'`.
- Validación con Zod en API routes.
- Sesión: nunca exponer token, solo hash en DB.
- Cookies: HttpOnly, SameSite=Lax, Secure en prod.
- i18n: español por defecto, idioma guardado en DB + cookie + localStorage.
- Temas: LIGHT/DARK/SYSTEM via next-themes.
- No usar `NEXT_PUBLIC_*` para claves IA. Claves se prueban efímeras en navegador, configuración real por variables servidor.

## Flujo típico de trabajo
1. `bash scripts/start.sh` o `npm run start:docker`
2. Crear feature en `src/app` o `src/components`
3. Cambios de DB: crear archivo SQL en `database/migrations/` → `npm run db:migrate` → `npm run db:seed` si necesario
4. Validar con `npm run lint`
5. Registrar cambios en `logs/` generados automáticamente

## Qué no tocar sin necesidad
- Lógica de sesión en `src/lib/auth.ts`
- Cliente pool en `src/lib/db.ts` (singleton)
- Middleware `src/middleware.ts`
- Seed inicial de datos de ejemplo

## Herramientas útiles
- React Doctor: `npm run doctor`
- Logs: `logs/start-local-*.md`, `logs/start-docker-*.md`
- Prisma Studio eliminado; usar pgAdmin en Docker o `psql` directamente

## Extensiones futuras previstas
OAuth, magic links, verificación email, recuperación password, MFA, calendario externo, PWA, notificaciones push.

---
Este archivo es la entrada única para cualquier agente. Lee primero este documento, luego README.md para operaciones detalladas.
