# Quickstart para agentes

## 1. Entender en 30 segundos
TimeLock-v es una app web de control total del tiempo. Usuario programa actividades con hora exacta, hace temporizador regresivo real, gana puntos por categoría, consigue recompensas y cadena diaria. Modos SYNCHRONOUS y FREE, modo viaje, sugerencias IA.

## 2. Cómo arrancar
```bash
# Local
bash scripts/start.sh
# Docker
bash scripts/start-docker.sh
# Dev rápido
npm run dev
```
Puerto por defecto: 3000

## 3. Estructura mínima a conocer
- `src/app/` → rutas y API
- `src/components/` → UI
- `src/lib/auth.ts` → sesiones, nunca tocar sin razón
- `database/migrations/` → SQL estilo Laravel (UP + `-- DOWN`)
- `src/middleware.ts` → protección rutas

## 4. Cambiar datos
```bash
tl migrate [--seed]     # aplicar migraciones (+ seed)
tl make:migration nombre # crear una migración nueva (UP/DOWN)
tl make:seeder nombre   # crear un seeder
tl seed
```
Logs en `logs/`

## 5. Reglas de oro
- Siempre filtrar por `userId` en API.
- Validar con Zod.
- No exponer tokens, solo hash.
- Cookies HttpOnly.
- i18n: es por defecto.
- Tema con next-themes.

## 6. Tareas comunes
- Nueva página: `src/app/dashboard/nueva/page.tsx`
- Nuevo componente: `src/components/`
- Nueva API: `src/app/api/.../route.ts` + `requireUser()`
- Nuevo campo User: `tl make:migration nombre` → `tl migrate` → actualizar código.

Ver `AGENTS.md` para detalle completo.
