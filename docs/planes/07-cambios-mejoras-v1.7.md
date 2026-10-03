# TimeLock-v – Documento de Cambios v1.7
## Nuevo módulo Estadísticas + Sidebar contraíble + Navegación inferior en móviles

**Fecha:** 8 de septiembre de 2026  
**Versión:** 1.7 (delta sobre v1.6)  
**Referencia:** Aplica sobre los documentos v1.0, v1.1, v1.2, v1.3, v1.4, v1.5 y v1.6 ya existentes.

---

## Cambios solicitados

### 1. Nuevo módulo "Estadísticas" en la sidebar

**Qué cambiar:**  
Agregar un nuevo módulo independiente llamado **"Estadísticas"** como segundo ítem en la barra lateral de navegación, justo debajo de "Resumen". Esto convierte las estadísticas en un módulo dedicado con su propia ruta (`/dashboard/stats`), en lugar de estar solo integradas en el Dashboard.

**Cómo cambiarlo:**

#### 1.1 Ubicación en la sidebar
El orden de la sidebar queda así:
1. Resumen (`/dashboard`)
2. **Estadísticas** (`/dashboard/stats`) ← NUEVO
3. Actividades
4. Sugerencias
5. Recompensas
6. Calendario
7. Cadena diaria
8. Perfil
9. Ajustes
10. Exportar

#### 1.2 Contenido del módulo Estadísticas
La página debe mostrar gráficos y estadísticas de avance con filtros, organizados en tarjetas/secciones:

**Sección A — Filtros globales (barra superior del módulo)**
- Filtro de rango de fechas (date range picker): Hoy / Esta semana / Este mes / Personalizado (desde-hasta)
- Filtro de actividades (multiselect con búsqueda): todas las actividades del usuario, con opción "Todas"
- Filtro de categorías (checkboxes): Deporte, Estudio, Trabajo, Ocio, etc.
- Los filtros deben afectar a todos los gráficos de la página en tiempo real.

**Sección B — Resumen rápido (4 tarjetas pequeñas, igual estilo que Dashboard)**
- Tiempo total registrado (en el rango seleccionado)
- Actividades completadas
- Puntos ganados
- Recompensas canjeadas

**Sección C — Gráficos principales (grid 2 columnas en desktop)**
- **Gráfico 1:** Tiempo por categoría (gráfico de barras o pastel) — muestra distribución del tiempo en el rango seleccionado.
- **Gráfico 2:** Evolución diaria (gráfico de línea) — muestra tiempo registrado día a día en el rango.
- **Gráfico 3:** Actividades más frecuentes (gráfico de barras horizontales) — top 10 actividades.
- **Gráfico 4:** Cumplimiento por día de la semana (gráfico de barras) — qué días cumple más.

**Sección D — Recompensas (tarjeta completa ancho)**
- Lista de recompensas canjeadas en el rango seleccionado.
- Para cada recompensa: nombre, fecha de canje, puntos gastados, icono/categoría.
- Total de puntos gastados en recompensas en el rango.
- Gráfico pequeño de canjes por semana/mes.

**Sección E — Cadenas y rachas (tarjeta completa ancho)**
- Cadena actual y cadena más larga.
- Historial visual de cadenas (calendario tipo GitHub contributions o lista).
- Días perfectos (100% de cumplimiento) en el rango.

**Sección F — Exportar estadísticas (botones)**
- Botón "Exportar este rango en PDF" (conecta con módulo Exportador existente).
- Botón "Exportar en CSV" (datos crudos de actividades del rango).

#### 1.3 Requisitos técnicos
- Usar **Recharts** (ya listado en el stack v1.1) para los gráficos. Es ligero, compatible con React 19 y personalizable con Tailwind.
- Los datos deben venir de Supabase con queries optimizadas (agregaciones en servidor cuando sea posible).
- Los filtros deben actualizar los gráficos sin recargar la página (estado local + refetch con TanStack Query o similar).
- Estado vacío: si no hay datos en el rango, mostrar mensaje amigable "No hay datos en este rango" con ilustración minimalista.
- Todo el texto debe usar `next-intl`.
- Mantener el estilo Notion (bordes sutiles `border-white/10`, fondos `bg-white/5` en dark mode).

#### 1.4 Traducciones necesarias
Agregar en `messages/es.json` y `messages/en.json`:
```json
{
  "stats": {
    "title": "Estadísticas",
    "subtitle": "Analiza tu progreso a lo largo del tiempo.",
    "filters": {
      "dateRange": "Rango de fechas",
      "today": "Hoy",
      "thisWeek": "Esta semana",
      "thisMonth": "Este mes",
      "custom": "Personalizado",
      "activities": "Actividades",
      "all": "Todas",
      "categories": "Categorías"
    },
    "summary": {
      "totalTime": "Tiempo total",
      "completedActivities": "Actividades completadas",
      "pointsEarned": "Puntos ganados",
      "rewardsRedeemed": "Recompensas canjeadas"
    },
    "charts": {
      "timeByCategory": "Tiempo por categoría",
      "dailyEvolution": "Evolución diaria",
      "topActivities": "Actividades más frecuentes",
      "complianceByDay": "Cumplimiento por día"
    },
    "rewards": {
      "title": "Recompensas canjeadas",
      "totalSpent": "Puntos gastados",
      "noData": "No has canjeado recompensas en este rango."
    },
    "chains": {
      "title": "Cadenas y rachas",
      "current": "Cadena actual",
      "longest": "Cadena más larga",
      "perfectDays": "Días perfectos"
    },
    "export": {
      "pdf": "Exportar en PDF",
      "csv": "Exportar en CSV"
    },
    "empty": "No hay datos en este rango. ¡Completa actividades para ver tus estadísticas!"
  }
}
```

---

### 2. Sidebar desplegable/contraíble

**Qué cambiar:**  
La barra lateral de navegación debe poder expandirse y contraerse. En estado contraído, solo muestra los iconos (sin texto). En estado expandido, muestra iconos + texto (comportamiento actual).

**Cómo cambiarlo:**

#### 2.1 Control de expansión
- Agregar un botón en la parte inferior de la sidebar (arriba de "Modo oscuro/claro") con icono de flecha (`PanelLeftClose` / `PanelLeftOpen` de lucide-react).
- Al hacer clic, la sidebar alterna entre:
  - **Expandida:** ancho ~250px, muestra iconos + texto de cada ítem.
  - **Contraída:** ancho ~64px, muestra solo iconos centrados.
- El estado debe persistir en `localStorage` (preferencia del usuario) y/o en el perfil del usuario en Supabase.

#### 2.2 Comportamiento en estado contraído
- Los ítems de la sidebar muestran solo el icono, centrado.
- Al hacer hover sobre un ítem, mostrar un **tooltip** con el nombre del módulo (ej: "Resumen", "Actividades").
- El logo "TimeLock-v" se oculta (solo queda el icono si existe, o se oculta completamente).
- El botón "Modo oscuro/claro" también se contrae a solo icono.
- El avatar de usuario (si aparece en la sidebar) se mantiene circular pequeño.

#### 2.3 Transición suave
- La expansión/contracción debe tener una animación suave (200-300ms) con `transition-all` de Tailwind.
- El contenido principal del dashboard debe ajustarse automáticamente al nuevo ancho de la sidebar (no superponerse).

#### 2.4 Requisitos técnicos
- Crear un contexto o estado global (`SidebarContext` o Zustand store) para manejar el estado expandido/contraído.
- El estado debe leerse al cargar la app desde `localStorage` (clave: `timelock-sidebar-expanded`, default: `true`).
- Mantener el estilo visual actual (fondo negro en dark mode, ítem activo con fondo blanco y texto negro).

---

### 3. Navegación inferior en móviles (bottom navigation bar)

**Qué cambiar:**  
En dispositivos con pantallas pequeñas (móviles y tablets pequeñas, breakpoint `< 768px` o `< 1024px` según convenga), la sidebar lateral debe ocultarse y reemplazarse por una barra de navegación inferior estilo app nativa.

**Cómo cambiarlo:**

#### 3.1 Breakpoint y comportamiento
- En pantallas **≥ 1024px** (desktop): sidebar lateral visible (comportamiento actual, con opción de contraer).
- En pantallas **< 1024px** (tablet pequeña y móvil): sidebar oculta, aparece bottom navigation bar.

#### 3.2 Bottom navigation bar
- Fija en la parte inferior de la pantalla (`fixed bottom-0 left-0 right-0`).
- Altura: ~64px.
- Fondo: negro en dark mode, blanco en light mode (con borde superior sutil `border-white/10`).
- Muestra **5 ítems principales** (los más usados), con icono + label pequeño:
  1. Resumen (🏠)
  2. Actividades (⚡)
  3. Calendario (📅)
  4. Estadísticas (📊)
  5. Perfil (👤)
- Los demás módulos (Sugerencias, Recompensas, Cadena diaria, Ajustes, Exportar) se acceden desde un botón **"Más"** (⋯) que abre un menú modal o sheet desde abajo.

#### 3.3 Menú "Más"
- Al hacer clic en "Más", se abre un sheet/drawer desde abajo (usando `shadcn/ui Sheet` o similar).
- El sheet muestra los módulos restantes: Sugerencias, Recompensas, Cadena diaria, Ajustes, Exportar.
- Incluye también el toggle de tema (Modo oscuro/claro) y botón "Salir".
- Se cierra al hacer clic en un ítem o fuera del sheet.

#### 3.4 Indicador de ítem activo
- El ítem activo en la bottom nav debe tener un indicador visual claro (icono en color blanco/primario, label en negrita, o fondo sutil).
- Mantener consistencia con el estilo de la sidebar (mismos iconos de lucide-react).

#### 3.5 Safe area en móviles
- La bottom nav debe respetar el safe area de iOS (`padding-bottom: env(safe-area-inset-bottom)`).
- El contenido principal debe tener padding inferior suficiente para no quedar tapado por la bottom nav (~80px).

#### 3.6 Requisitos técnicos
- Crear un componente `BottomNav` separado de `Sidebar`.
- Usar un hook `useMediaQuery` o breakpoints de Tailwind (`lg:`) para alternar entre sidebar y bottom nav.
- Ambos componentes deben leer la misma lista de módulos desde un archivo de configuración centralizado (ej: `lib/navigation.ts`) para no duplicar rutas.
- El estado de "ítem activo" debe sincronizarse entre sidebar y bottom nav (ambos reflejan la ruta actual).

---

## Restricciones

1. **NO eliminar** ninguna funcionalidad existente (QR, estadísticas integradas en Dashboard, modo pausa, etc.). Las estadísticas del Dashboard siguen existiendo; el nuevo módulo es complementario.
2. **NO romper** la navegación en los demás módulos.
3. **NO hardcodear** strings: todo debe pasar por `next-intl`.
4. **NO cambiar** el estilo visual general (Notion blanco/negro).
5. **NO usar** librerías nuevas sin justificar. Recharts ya está en el stack; si se necesita `use-debounce` para filtros, justificarlo.
6. La bottom nav debe ser **solo para pantallas pequeñas**; en desktop sigue la sidebar.
7. La sidebar contraíble debe funcionar en desktop y tablet grande (≥ 1024px).
8. Validar todo con `zod` donde aplique (ej: filtros de fechas).
9. Respetar RLS de Supabase en todas las queries nuevas.
10. Los gráficos deben ser accesibles (labels, tooltips, contraste adecuado).

---

## Criterios de aceptación

- [ ] El módulo "Estadísticas" aparece como segundo ítem en la sidebar, debajo de "Resumen".
- [ ] La ruta `/dashboard/stats` carga correctamente con la sidebar visible.
- [ ] El módulo Estadísticas tiene filtros de fechas, actividades y categorías funcionales.
- [ ] Se muestran 4 tarjetas de resumen rápido (tiempo, actividades, puntos, recompensas).
- [ ] Se muestran 4 gráficos principales (tiempo por categoría, evolución diaria, top actividades, cumplimiento por día).
- [ ] Se muestra la sección de recompensas canjeadas con lista y total de puntos gastados.
- [ ] Se muestra la sección de cadenas y rachas.
- [ ] Los botones de exportar PDF y CSV funcionan.
- [ ] El estado vacío muestra mensaje amigable cuando no hay datos.
- [ ] La sidebar se puede contraer a solo iconos con un botón.
- [ ] El estado expandido/contraído persiste en `localStorage`.
- [ ] En estado contraído, los tooltips muestran el nombre del módulo al hacer hover.
- [ ] El contenido principal se ajusta al ancho de la sidebar sin superponerse.
- [ ] En pantallas < 1024px, la sidebar se oculta y aparece la bottom navigation bar.
- [ ] La bottom nav muestra 5 ítems principales + botón "Más".
- [ ] El botón "Más" abre un sheet con los módulos restantes.
- [ ] La bottom nav respeta el safe area de iOS.
- [ ] El contenido principal tiene padding inferior para no quedar tapado por la bottom nav.
- [ ] Todo el texto nuevo está en `es.json` y `en.json`.
- [ ] La app compila sin errores de TypeScript (`tsc --noEmit` limpio).
- [ ] No hay regresiones en los demás módulos.

---

## Orden de ejecución recomendado

1. **Cambio 3 (Bottom nav + responsive)** — es el más estructural, define cómo se comporta la navegación en móvil.
2. **Cambio 2 (Sidebar contraíble)** — complementa el cambio 3, ambos tocan la navegación.
3. **Cambio 1 (Módulo Estadísticas)** — es independiente y puede construirse sobre la navegación ya corregida.

Si algún cambio es muy largo, divídelo en subtareas e indícame en qué parte vas (ej: "Parte 1 de 2: gráficos principales").
