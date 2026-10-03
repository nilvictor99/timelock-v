# PROMPT MAESTRO — TimeLock-v v1.3
## Separación de Perfil/Ajustes + Expansión de campos + IA para sugerencias + Corrección QR

---

##  ROL
Actúa como un **Ingeniero de Software Senior experto en Next.js 15/16 (App Router), React 19, TypeScript, Tailwind CSS 4 y shadcn/ui**, con experiencia en aplicaciones de productividad, i18n con `next-intl`, Supabase (Auth + Postgres + Storage) y diseño de UX estilo Notion (blanco/negro minimalista).

---

##  CONTEXTO DEL PROYECTO
**TimeLock-v** es una aplicación web de control de tiempo para adultos 18+, estilo Notion, con gamificación seria (puntos, cadenas, recompensas). 

**Stack actual:**
- Next.js 15/16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Supabase (Auth + Postgres + Storage)
- `next-intl` para i18n (español por defecto, inglés disponible)
- `next-themes`, `date-fns`, Framer Motion, lucide-react
- `qrcode`, `jspdf`, `html5-qrcode` para QR

**Estado actual (problemas a resolver):**
1. Las rutas `/dashboard/settings` y `/dashboard/profile` **no muestran la barra lateral de navegación (sidebar)**. El resto de módulos (Dashboard, Actividades, Sugerencias, Recompensas, Calendario, Cadena diaria, Exportar) sí la muestran correctamente.
2. El módulo **Perfil** está incompleto: solo tiene foto, nombre, biografía, país, ciudad, zona horaria, idioma, QR y estadísticas. Faltan campos clave para personalizar sugerencias.
3. El módulo **Ajustes** está incompleto: solo tiene Idioma, Tema, Modo de operación y Modo Pausa. Faltan campos de notificaciones, formato, privacidad y configuración de IA.
4. El botón **"Copiar enlace"** del QR copia el base64 de la imagen del QR, no el enlace real con el token. El login con QR espera un token, no un base64.
5. No hay integración con IA para generar sugerencias basadas en el perfil del usuario.

---

## 🎯 TAREA PRINCIPAL
Implementar las siguientes mejoras **sin eliminar ni romper** ninguna funcionalidad existente. Todo cambio debe ser aditivo o de corrección.

---

### ✅ TAREA 1 — Corregir la sidebar en Perfil y Ajustes

**Problema:** Al navegar a `/dashboard/settings` o `/dashboard/profile` la sidebar desaparece.

**Solución:**
- Revisar el layout de `/dashboard/` (`app/dashboard/layout.tsx` o equivalente).
- Asegurar que el layout padre renderice la sidebar para **todas** las rutas hijas, incluyendo `settings` y `profile`.
- Si existe un layout anidado en `app/dashboard/settings/layout.tsx` o `app/dashboard/profile/layout.tsx` que esté sobrescribiendo el layout padre, eliminarlo o extenderlo correctamente.
- Verificar que los links de navegación en la sidebar apunten correctamente a `/dashboard/profile` y `/dashboard/settings`.
- Mantener el estilo visual actual de la sidebar (iconos lucide-react, estado activo resaltado).

**Entregable:** Código del layout corregido + explicación breve de qué causaba el bug.

---

### ✅ TAREA 2 — Expandir el módulo Perfil (`/dashboard/profile`)

**Regla de oro:** NO eliminar los campos existentes (foto, nombre, biografía, país, ciudad, zona horaria, idioma, QR, estadísticas de cuenta). Solo AGREGAR y hacer EDITABLES los que falten.

**Campos a agregar, organizados en secciones colapsables (acordeones) o tabs para no saturar la UI:**

#### Sección A — Datos personales básicos
- Nombre / Apodo (ya existe, mantener)
- Edad (calculada automáticamente desde fecha de nacimiento, solo lectura)
- Fecha de nacimiento (opcional, date picker)
- Género / identidad de género (opcional, select: Hombre / Mujer / No binario / Prefiero no decirlo / Otro)
- Ubicación (ciudad y país — ya existen, mantener)

#### Sección B — Información física y de salud
- Nivel de condición física (select: Principiante / Intermedio / Avanzado)
- Limitaciones físicas o lesiones (textarea, opcional)
- Preferencia de intensidad de ejercicio (select: Suave / Moderada / Intensa)

#### Sección C — Habilidades e intereses
- Habilidades o talentos (campo de tags múltiple, ej: "programación", "cocina", "idiomas")
- Nivel de experiencia por habilidad (badge por cada tag: Básico / Intermedio / Experto)
- Hobbies e intereses principales (tags múltiple)
- Deportes o actividades físicas que practica (tags múltiple)
- Actividades creativas que le gustan (tags múltiple)
- Intereses de aprendizaje (tags múltiple)

#### Sección D — Preferencias de actividades
- Tipos de actividades preferidas (checkboxes múltiples: Físicas / Mentales / Creativas / Sociales / Relajantes / Productivas)
- Duración preferida de las actividades (select: 15 min / 30 min / 45 min / 60 min / 90 min / Flexible)
- Momento del día preferido (checkboxes: Mañana / Mediodía / Tarde / Noche)
- Preferencia solo / en grupo (select: Solo / Grupo / Indiferente)
- Nivel de energía típico (slider o select: Bajo / Medio / Alto)
- Preferencia indoor / outdoor (select: Indoor / Outdoor / Indiferente)
- Presupuesto aproximado para actividades (select: Gratis / Bajo / Medio / Alto / Sin límite)

#### Sección E — Estilo de vida y disponibilidad
- Horario laboral o de estudios (dos time pickers: inicio y fin, por día de la semana o general)
- Días libres habituales (checkboxes: L M M J V S D)
- Tiempo libre disponible diario (select o input numérico en minutos)
- Acceso a espacios o recursos (checkboxes: Gimnasio / Cocina / Parque / Biblioteca / Piscina / Estudio / Otro)

#### Sección F — Objetivos personales
- Objetivos principales (textarea o lista de hasta 5 objetivos editables)
- Metas a corto plazo (textarea, horizonte 30-90 días)
- Nivel de motivación actual (slider 1-10 o select: Bajo / Medio / Alto / Muy alto)

#### Sección G — Cuenta y seguridad (EXISTENTE, ampliar)
- Foto de perfil (mantener)
- **Email** (hacer EDITABLE con verificación por correo actual antes de cambiar)
- **Contraseña** (agregar botón "Cambiar contraseña" que abra modal con: contraseña actual + nueva + confirmar)
- Zona horaria (mantener)
- Idioma (mantener)
- QR de inicio de sesión (mantener, ver TAREA 5 para corrección)
- Estadísticas de cuenta (mantener)

**Requisitos técnicos del Perfil:**
- Usar `react-hook-form` + `zod` para validación.
- Guardar en Supabase (tabla `profiles` con columnas JSONB para tags y arrays).
- Mostrar toast de éxito/error al guardar (`sonner`).
- Diseño responsive, estilo Notion (bordes sutiles, fondo negro en dark mode, tipografía limpia).
- Todo el texto debe usar `next-intl` (traducciones en `es.json` y `en.json`).

---

### ✅ TAREA 3 — Expandir el módulo Ajustes (`/dashboard/settings`)

**Regla de oro:** NO eliminar los campos existentes (Idioma, Tema, Modo de operación, Modo Pausa con motivo). Solo AGREGAR.

**Campos a agregar, organizados en tarjetas/secciones:**

#### Sección A — Preferencias (EXISTENTE, mantener)
- Idioma (Español / Inglés) — mantener
- Tema (Claro / Oscuro / Sistema) — mantener
- Modo de operación (Sincrónico / Libre) — mantener

#### Sección B — Formato y región (NUEVO)
- Zona horaria (select con detección automática, ya está en Perfil pero mantener aquí también como override)
- Formato de hora (select: 12h / 24h)
- Unidad de medida (select: Métrico / Imperial) — aplicable si en el futuro se agregan actividades físicas con distancia

#### Sección C — Notificaciones y recordatorios (NUEVO)
- Activar / desactivar notificaciones (switch global)
- Tipos de notificación activos (checkboxes: 15 min antes / 5 min antes / Al terminar / Recordatorio cada hora)
- Frecuencia de notificaciones (select: Todas / Solo importantes / Silenciar)
- Horario preferido para recibir recordatorios (time range: desde/hasta, para no notificar de noche)
- Voz de notificaciones (switch + selector de voz + volumen slider) — ya existe en plan original, implementar si no está

#### Sección D — Preferencias del generador de actividades (NUEVO)
- Tipo de generación (slider: Más aleatorio ←→ Más personalizado según perfil)
- Evitar repetir actividades recientes (switch + selector de ventana: últimos 3/7/14/30 días)
- Mostrar historial de actividades completadas en sugerencias (switch)

#### Sección E — Privacidad y cuenta (NUEVO)
- Visibilidad del perfil (select: Privado / Público)
- Exportar datos (botones: Exportar JSON / Exportar CSV / Exportar PDF — conectar con módulo Exportador existente)
- Eliminar cuenta (botón rojo con doble confirmación + escritura del email para confirmar)

#### Sección F — Modo Pausa (EXISTENTE, mantener)
- Switch activar/desactivar
- Motivo opcional (textarea)
- Mantener comportamiento actual de reprogramación

#### Sección G — Integración con IA (NUEVO — ver TAREA 4)

**Requisitos técnicos de Ajustes:**
- Usar `react-hook-form` + `zod`.
- Cada sección debe poder guardarse independientemente (no un solo formulario gigante).
- Toast de confirmación por cada guardado.
- Todo con `next-intl`.

---

### ✅ TAREA 4 — Integración con IA para sugerencias personalizadas

**Objetivo:** Que el módulo "Sugerencias Inteligentes" use el perfil del usuario (TAREA 2) para generar actividades personalizadas mediante IA.

**Requisitos:**

#### 4.1 Configuración de proveedores de IA (en Ajustes, Sección G)
- Selector de proveedor (select: NVIDIA NIM / OpenRouter / OpenAI / Anthropic / Google Gemini / Ollama local / Personalizado)
- Campo para API Key (input tipo password con botón mostrar/ocultar, guardado cifrado o en variable de entorno del servidor)
- Campo para modelo (input con autocompletado según proveedor, ej: `meta/llama-3.1-70b-instruct`, `nvidia/llama-3.1-nemotron-70b-instruct`)
- Campo para base URL personalizada (para Ollama o proxies)
- Campo para temperatura (slider 0-2, default 0.7)
- Campo para max tokens (input numérico, default 500)
- Botón "Probar conexión" que haga un call mínimo y muestre éxito/error

#### 4.2 Prompt del sistema para sugerencias
Crear un archivo `lib/ai/prompts.ts` con el system prompt que:
- Reciba el perfil completo del usuario (JSON)
- Reciba el historial de los últimos 7 días
- Reciba la cadena actual y puntos
- Devuelva un JSON con 3-5 actividades sugeridas para hoy, cada una con: nombre, categoría, duración estimada, hora sugerida, razón (por qué se sugiere), puntos estimados

#### 4.3 Endpoint de servidor
Crear `app/api/suggestions/route.ts` (Route Handler) que:
- Valide sesión del usuario
- Lea su perfil de Supabase
- Construya el prompt
- Llame al proveedor configurado (usando `fetch` directo, sin SDK pesado)
- Parsee la respuesta JSON
- Guarde las sugerencias en la tabla `suggestions` de Supabase
- Devuelva la lista al cliente

**Manejo de errores:**
- Si no hay API key configurada → mostrar mensaje amigable invitando a configurarla
- Si la IA falla → fallback a sugerencias rule-based existentes (las que ya hay en el plan original)
- Rate limiting para no quemar la API key

#### 4.4 UI en módulo Sugerencias
- Mostrar las 3-5 sugerencias con botón "Añadir a hoy" en cada una
- Indicador visual de que fue generado por IA (badge pequeño "✨ IA")
- Botón "Regenerar sugerencias"
- Estado de carga elegante (skeleton)

---

### ✅ TAREA 5 — Corrección del QR de inicio de sesión rápido

**Problema actual:** El botón "Copiar enlace" copia el base64 de la imagen del QR. El login espera un token, no un base64.

**Solución:**

#### 5.1 Mostrar el TOKEN explícitamente
En la tarjeta de Seguridad del Perfil, debajo del QR y del botón "Generar nuevo QR", agregar:


┌─────────────────────────────────────────┐
│  [QR IMAGE]                             │
│  Escanea este código...                 │
│                                         │
│  [Generar nuevo QR]                     │
│  Válido hasta: 7/9/2026, 10:26:00       │
│                                         │
│   Token:  abc123-def456-ghi789        │
│  [Copiar token]                         │
│                                         │
│  🔗 Enlace: https://timelock.app/
...    │
│  [Copiar enlace]                        │
│                                         │
│  [Descargar PNG]  [Descargar PDF]       │
│                                         │
│  ️ Este archivo contiene un acceso...  │
└─────────────────────────────────────────┘


#### 5.2 Comportamiento correcto
- **"Copiar token"** → copia solo el token (ej: `abc123-def456-ghi789`) al portapapeles.
- **"Copiar enlace"** → copia la URL completa con el token como query param: `https://timelock.app/login?qr=abc123-def456-ghi789` (NO el base64).
- El login con QR debe aceptar tanto el token pegado manualmente como la URL completa (extraer el param `qr` si viene como URL).

#### 5.3 Seguridad (mantener lo ya definido en v1.2)
- Token de un solo uso, expira en 10 minutos.
- Generado en el servidor, solo se guarda el hash SHA-256 en BD.
- Reclamación atómica (`usedAt = null AND expiresAt > now()`).
- Headers `Cache-Control: no-store`.
- Al generar uno nuevo, revocar los anteriores.

---

## 🚫 RESTRICCIONES OBLIGATORIAS

1. **NO eliminar** ningún campo ni funcionalidad existente. Todo cambio es aditivo.
2. **NO romper** la sidebar en otras rutas.
3. **NO hardcodear** strings: todo debe pasar por `next-intl` (`useTranslations`).
4. **NO cambiar** el estilo visual general (Notion blanco/negro). Los nuevos campos deben seguir el mismo lenguaje de diseño (bordes sutiles `border-white/10`, fondos `bg-white/5` en dark mode, tipografía sans-serif).
5. **NO usar** librerías nuevas sin justificar. Si se necesita algo, proponerlo primero.
6. **Mantener** el Modo Libre / Sincrónico funcionando exactamente como está.
7. **Mantener** el Modo Pausa funcionando exactamente como está.
8. Las nuevas columnas de la BD deben ser **opcionales** (nullable) para no romper usuarios existentes.
9. Validar todo con `zod` tanto en cliente como en servidor (Server Actions o Route Handlers).
10. Respetar RLS (Row Level Security) de Supabase en todas las queries nuevas.

---

##  FORMATO DE ENTREGA ESPERADO

Para cada tarea, entrega en este orden:

1. **Breve análisis** (2-3 líneas) de qué se va a hacer.
2. **Cambios en la base de datos** (SQL de Supabase para nuevas columnas/tablas, con migración reversible).
3. **Archivos a crear o modificar** (lista con ruta completa).
4. **Código completo** de cada archivo nuevo o modificado (no fragments, código completo y funcional).
5. **Traducciones** necesarias para `messages/es.json` y `messages/en.json`.
6. **Instrucciones de prueba** (cómo verificar que funciona).
7. **Posibles edge cases** y cómo los manejas.

**Orden de ejecución recomendado:**
1. TAREA 1 (sidebar) — es rápida y desbloquea el resto.
2. TAREA 5 (QR) — es una corrección puntual.
3. TAREA 2 (Perfil) — requiere cambios en BD.
4. TAREA 3 (Ajustes) — depende de Perfil en algunos campos.
5. TAREA 4 (IA) — es la más compleja, va al final.

Si alguna tarea es muy larga, divídela en subtareas y entrégala por partes, pero **siempre indicando en qué parte vas** (ej: "Parte 1 de 3: esquema de BD").

---

## 🧪 CRITERIOS DE ACEPTACIÓN

- [ ] La sidebar se ve en `/dashboard/settings` y `/dashboard/profile`.
- [ ] El Perfil tiene todas las secciones (A-G) con datos persistentes en Supabase.
- [ ] El email y la contraseña son editables desde el Perfil con validación.
- [ ] Los Ajustes tienen todas las secciones (A-G) sin perder Idioma/Tema/Modo/Modo Pausa.
- [ ] El QR muestra el token en texto y el botón "Copiar enlace" copia la URL, no el base64.
- [ ] El login con QR acepta tanto token suelto como URL completa.
- [ ] El módulo Sugerencias puede llamar a una IA configurada y mostrar resultados.
- [ ] Si la IA no está configurada o falla, hay fallback a sugerencias rule-based.
- [ ] Todo el texto nuevo está en `es.json` y `en.json`.
- [ ] La app compila sin errores de TypeScript (`tsc --noEmit` limpio).

---

##  INSTRUCCIÓN FINAL

Confirma que entendiste todas las tareas antes de empezar. Luego comienza por la **TAREA 1 (sidebar)**. Si algo no está claro o hay ambigüedad, pregúntame antes de asumir. No inventes comportamientos que no estén especificados.

Cuando termines una tarea, espera mi confirmación antes de pasar a la siguiente.
