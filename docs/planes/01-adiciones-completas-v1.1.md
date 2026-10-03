**TimeLock-v – Documento de Adiciones y Completado**  
**Versión 1.1 – Complemento al Plan Original (plan.md)**  
Fecha: 5 de septiembre de 2026

Este documento completa y amplía el plan original de TimeLock-v. Incluye todo lo que faltaba (inicio de sesión, homepage, configuración avanzada de usuario, modos de operación, features adicionales recomendadas) + investigación de mejores prácticas 2025-2026 + stack tecnológico y paquetes recomendados.

---

### 1. Autenticación e Inicio de Sesión (Nuevo Módulo Obligatorio)

**Objetivo**: Permitir que cada usuario tenga su propia cuenta segura, datos personales, preferencias y progreso (cadenas, puntos, recompensas, historial).

#### Flujo completo de autenticación
- **Registro (Sign Up)**:
  - Email + contraseña (mínimo 12 caracteres, verificación contra listas de contraseñas filtradas).
  - Opción de registro con Google / Apple / GitHub (OAuth).
  - Magic Link (enlace mágico por email) como alternativa passwordless.
  - Confirmación de email obligatoria.
  - Checkbox de aceptación de términos (solo mayores de 18 años).

- **Inicio de sesión (Login)**:
  - Email + contraseña.
  - Magic Link.
  - OAuth (Google, Apple, GitHub).
  - Opción “Recordar este dispositivo” (sesión extendida).
  - Soporte de Passkeys / WebAuthn (recomendado 2026).

- **Recuperación de cuenta**:
  - Reset de contraseña por email (token de un solo uso, expiración 30-60 min).
  - Recuperación con MFA si está activado.

- **Seguridad obligatoria**:
  - MFA opcional (TOTP con apps como Google Authenticator / Authy) – recomendado.
  - Rate limiting en intentos de login.
  - Sesiones con cookies HttpOnly + Secure + SameSite.
  - Logout real (invalidación de sesión en servidor).
  - Protección contra fuerza bruta y credential stuffing.

#### Recomendación de proveedores (2026)
| Proveedor       | Mejor para                          | Free tier          | Notas |
|-----------------|-------------------------------------|--------------------|-------|
| **Clerk**       | Mejor DX + UI pre-built + Next.js  | 10k MAU           | Recomendado principal |
| **Supabase Auth** | Si usas Supabase como backend     | 50k MAU           | Excelente + RLS |
| **Better Auth** | Self-hosted + control total        | Ilimitado         | Muy buena opción open-source |
| Auth.js (NextAuth) | Máximo control                     | Ilimitado         | Más trabajo manual |

**Recomendación final para TimeLock-v**:  
**Clerk** (si quieres velocidad y UI bonita) o **Supabase Auth** (si quieres todo en un solo backend + base de datos).

---

### 2. Homepage / Landing Page (Nuevo – Público)

Página de entrada **antes** de iniciar sesión. Estilo Notion (blanco/negro limpio).

#### Secciones recomendadas
1. **Hero**
   - Título potente: “Domina tu tiempo. Elimina el desperdicio.”
   - Subtítulo corto.
   - CTA principal: “Empieza gratis” / “Crear cuenta”.
   - CTA secundario: “Ver demo” o “Iniciar sesión”.

2. **Cómo funciona** (3-4 pasos visuales)
   - Programa actividades con hora real.
   - Gana puntos y construye cadenas.
   - Recibe recompensas que tú eliges.
   - Exporta tu progreso en PDF.

3. **Características principales** (grid de 6-8 cards)
   - Temporizador regresivo real.
   - Modo Sincrónico vs Modo Libre.
   - Cadenas ilimitadas.
   - Recompensas personalizadas.
   - Estadísticas avanzadas.
   - Modo Viaje / Campamento.
   - Exportador PDF.
   - 100% privado (tus datos solo tuyos).

4. **Prueba social / Beneficios**
   - “Diseñada exclusivamente para adultos y jóvenes 18+”.
   - Enfoque serio y profesional (sin gamificación infantil).

5. **Footer**
   - Links: Términos, Privacidad, Contacto, Blog (futuro).
   - Selector de idioma (ES / EN).

Diseño: 100% responsive, dark/light mode desde el primer momento, tipografía limpia sans-serif.

---

### 3. Configuración de Usuario (Ampliación fuerte de “Perfil y Ajustes”)

#### 3.1 Datos del Usuario
- Nombre / Apodo
- Email (no editable o con verificación)
- Foto de perfil (opcional)
- Zona horaria (detección automática + manual)
- Idioma (Español / Inglés)
- Fecha de nacimiento (solo para verificación 18+)

#### 3.2 Tema de la Aplicación
- Claro / Oscuro / Sistema (seguir el OS)
- Persistencia de preferencia por usuario

#### 3.3 Modo de Operación de la App (NUEVO – muy importante)
El usuario elige **uno** de estos dos modos principales (se puede cambiar en cualquier momento):

**A. Modo Sincrónico (Real-Time / Cronograma estricto)** – por defecto
- Todas las actividades tienen hora exacta de inicio y fin.
- El temporizador se sincroniza con la hora real del dispositivo.
- Si pasa la hora → se marca como “desperdicio”.
- Botón “Pasar actividad” reordena automáticamente el resto del día.
- Ideal para personas que quieren disciplina máxima.

**B. Modo Libre (Flexible / Sin horario forzado)**
- Las actividades no tienen hora de inicio obligatoria.
- El usuario decide cuándo empezar cada una.
- Solo se registra la duración real usada.
- No hay “desperdicio” por hora.
- Ideal para días caóticos, viajes o personas con horarios variables.
- Sigue permitiendo puntos, cadenas y recompensas.

El modo se guarda en el perfil y afecta a **todas** las pantallas (Dashboard, Actividades, Calendario, etc.).

#### 3.4 Otras configuraciones
- Notificaciones (15 min, 5 min, al terminar, recordatorio cada hora).
- Voz de notificaciones (activar/desactivar + volumen).
- Puntos por categoría (editable).
- Preferencias de cadena (umbrales personalizados opcionales).
- Exportación de datos (JSON / CSV).
- Eliminar cuenta (con confirmación fuerte).

---

### 4. Features Adicionales Recomendadas (que faltaban o fortalecen la app)

1. **Onboarding guiado** (primera vez que entra)
   - Explicación de Modo Sincrónico vs Libre.
   - Crear primeras 3-5 actividades.
   - Configurar categorías y puntos.

2. **Backup y Exportación completa de datos**
   - Exportar todo el historial en JSON + PDF.
   - Importar datos (futuro).

3. **Integración de calendario externo** (opcional avanzada)
   - Google Calendar / Apple Calendar (solo lectura o bidireccional).

4. **Recordatorios inteligentes y “Focus Mode”**
   - Bloqueo suave de distracciones (solo web).

5. **Logros / Badges** (además de cadenas)
   - “7 días perfectos”, “100 horas de estudio”, etc.

6. **Modo Offline básico**
   - Guardar actividades y sincronizar al volver online (PWA).

7. **Soporte multi-dispositivo**
   - Sincronización en tiempo real entre móvil y desktop.

8. **Página de Privacidad y Términos** claras (importante por ser 18+).

9. **Sistema de feedback in-app** (para mejorar la app).

10. **Modo “Solo lectura” o “Vista de invitado”** (opcional para compartir progreso sin login).

---

### 5. Stack Tecnológico Recomendado (2026)

**Frontend**
- Next.js 15/16 (App Router) + React 19
- TypeScript
- Tailwind CSS 4 + shadcn/ui
- Zustand o TanStack Query (estado)
- next-themes (dark/light)
- date-fns o dayjs (fechas)
- Framer Motion (animaciones de cadenas)

**Backend / Base de datos / Auth**
- **Opción A (recomendada para velocidad)**: Supabase (Auth + Postgres + Realtime + Storage)
- **Opción B**: Clerk (Auth) + Supabase o Neon (Postgres) + Prisma/Drizzle

**PDF**
- @react-pdf/renderer o pdfkit + jspdf
- html2canvas + jsPDF (alternativa simple)

**Gráficos / Estadísticas**
- Recharts o ApexCharts
- Chart.js (más liviano)

**Calendario**
- FullCalendar o DayPilot
- react-big-calendar

**Notificaciones**
- Web Push API + service workers (PWA)
- Sonner (toasts)

**Otros paquetes útiles**
- zod (validación)
- lucide-react (iconos)
- react-hook-form
- @tanstack/react-table (tablas de estadísticas)
- date-fns-tz (zonas horarias)
- next-intl o next-i18n (idiomas)
- PWA con next-pwa o @ducanh2912/next-pwa

**Hosting**
- Vercel (frontend + serverless)
- Supabase (backend)

---

### 6. Estructura de Módulos Actualizada (completa)

1. Landing / Homepage (público)
2. Auth (Login / Register / Recover)
3. Onboarding
4. Dashboard / Home (privado)
5. Actividades (Diario + Semanal)
6. Temporizador Regresivo Inteligente
7. Sugerencias Inteligentes
8. Recompensas
9. Calendario Integrado
10. Estadísticas Avanzadas
11. Sistema de Cadena Diaria
12. Modo Viaje / Campamento
13. Perfil y Ajustes (ampliado con Modo Sincrónico/Libre)
14. Exportador de PDF
15. Configuración de Notificaciones y Preferencias

---

### 7. Resumen de lo que se agregó

- Sistema completo de autenticación seguro (Clerk o Supabase Auth).
- Homepage / Landing page profesional.
- Configuración de usuario con:
  - Datos personales
  - Tema
  - **Modo Sincrónico vs Modo Libre** (clave)
- Features extras de productividad modernas (onboarding, export completo, offline, etc.).
- Stack tecnológico actualizado y realista para 2026.
- Lista de paquetes concretos listos para usar.

---

**TimeLock-v ahora está completamente definido** para empezar a programar.

¿Quieres que genere a continuación:
1. Los wireframes de todas las pantallas nuevas (Auth + Homepage + Settings),
2. El esquema de base de datos (Supabase/Postgres),
3. O el código base completo (Next.js + Tailwind + shadcn + Auth)?

Solo dime “Sí, empieza con [opción]” y lo entrego.  

¡Listo para construir! 🔥
