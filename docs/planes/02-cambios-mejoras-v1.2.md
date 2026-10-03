**TimeLock-v – Documento de Cambios y Mejoras**  
**Versión 1.2 – Actualización de Arquitectura y UX**  
Fecha: 5 de septiembre de 2026

Este documento registra los cambios estructurales y de experiencia de usuario solicitados sobre el plan original y el documento de adiciones (v1.1). Todos los puntos están detallados, investigados y listos para implementación.

---

### 1. Idiomas (i18n) – Corrección y Mejora

**Problema actual**: Al cambiar el idioma a inglés desde Configuración, la interfaz no se actualiza correctamente en todas las pantallas (especialmente perfil y ajustes).

**Solución obligatoria**:
- Implementar i18n completo y robusto con `next-intl` o `next-i18next` (recomendado para App Router).
- El idioma debe persistir en el perfil del usuario (base de datos) + cookie/localStorage.
- Al cambiar el idioma en Ajustes:
  1. Se guarda inmediatamente en el perfil del usuario.
  2. Se actualiza el locale de la aplicación.
  3. Se recarga/re-renderiza toda la UI sin perder el estado de la sesión.
- Todas las cadenas de texto (incluyendo Perfil, Ajustes, Dashboard, etc.) deben estar en archivos de traducción (`es.json` / `en.json`).
- Español sigue siendo el idioma por defecto.
- Incluir soporte de fechas, números y zonas horarias según el locale.

**Notas técnicas**:
- Usar `localePrefix: 'as-needed'` o `'always'` según preferencia de URLs.
- Evitar strings hardcodeados.
- Probar exhaustivamente el cambio de idioma en tiempo real.

---

### 2. Separación de Perfil de Usuario y Ajustes

**Cambio estructural**:
- **Perfil de Usuario** y **Ajustes** pasan a ser dos secciones/módulos claramente separados.

#### 2.1 Perfil de Usuario (nueva pantalla independiente)
Contiene toda la información personal y de identidad del usuario.

**Campos recomendados (basados en investigación de apps de productividad, habit trackers y time management 2025-2026)**:

**Información básica**:
- Foto de perfil (subida opcional – ver sección 3)
- Nombre / Apodo (display name)
- Email (solo lectura o con verificación para cambiar)
- Fecha de nacimiento (solo para validación 18+)
- Zona horaria (detección automática + override manual)
- Idioma preferido
- País / Ciudad (opcional)

**Información de productividad / identidad**:
- Biografía corta / “Sobre mí” (opcional, 160 caracteres)
- Objetivos principales (lista editable de 3-5 objetivos)
- Categorías favoritas de actividades
- Nivel de consistencia actual (basado en cadena)
- Fecha de registro en TimeLock-v
- Último acceso

**Seguridad e identidad**:
- QR de inicio de sesión rápido (ver sección 8)
- Estado de MFA (activado/desactivado)
- Dispositivos conectados (lista + opción de cerrar sesión remota)

**Estadísticas rápidas del perfil**:
- Días activos totales
- Cadena actual más larga
- Puntos totales acumulados
- Tiempo total registrado

#### 2.2 Ajustes (pantalla separada)
Contiene preferencias de comportamiento de la aplicación (no datos personales).

- Tema (Claro / Oscuro / Sistema)
- Idioma
- Modo de operación (Sincrónico / Libre)
- **Modo Pausa Global** (antes Modo Viaje – ver sección 4)
- Notificaciones (tipos, voz, volumen)
- Puntos por categoría
- Preferencias de temporizador
- Exportación de datos
- Privacidad y seguridad
- Eliminar cuenta

---

### 3. Foto de Perfil

- El usuario **puede subir** una foto de perfil si lo desea.
- Si no sube ninguna, se mantiene el comportamiento actual (iniciales o avatar generado automáticamente).
- Requisitos técnicos:
  - Formatos: JPG, PNG, WebP
  - Tamaño máximo: 2-5 MB
  - Recorte circular opcional en el cliente
  - Almacenamiento en Supabase Storage o similar
  - Optimización automática (redimensionado + compresión)
- La foto se muestra en:
  - Header / sidebar
  - Página de Perfil
  - Exportaciones PDF (opcional)

---

### 4. Eliminación del Módulo “Modo Viaje” y Renombrado Global

**Cambio**:
- El “Modo Viaje / Campamento” **deja de ser un módulo independiente**.
- Se convierte en una **opción dentro de Ajustes**.

**Nuevo nombre global recomendado**:
> **Modo Pausa**  
> (o “Pausa Temporal” / “Modo Ausencia”)

**Justificación del nombre**:
Es más amplio y comprensible. Cubre:
- Viajes
- Vacaciones
- Trabajo intensivo o turnos especiales
- Enfermedad / malestar
- Imprevistos personales o familiares
- Cualquier periodo en el que el usuario no pueda seguir su horario normal

**Comportamiento**:
- Al activar “Modo Pausa” desde Ajustes:
  - Se desactivan todas las actividades programadas de la semana actual.
  - Se guarda la fecha de inicio de la pausa.
  - Al desactivar el modo, las actividades se reprograman automáticamente a los días disponibles siguientes (manteniendo horarios relativos).
- Se puede indicar un motivo opcional (solo para el usuario): “Vacaciones”, “Enfermedad”, “Trabajo”, “Otro”.
- El Dashboard muestra un banner claro cuando el modo está activo.

---

### 5. Mejora del Módulo Calendario

El calendario debe permitir tres vistas claras y fáciles de cambiar:

- **Vista Día** (timeline vertical por horas)
- **Vista Semana** (7 columnas)
- **Vista Mes** (grid mensual clásico)

**Funcionalidades adicionales**:
- Selector de vista visible en la parte superior (tabs o dropdown).
- Navegación anterior / siguiente + botón “Hoy”.
- Colores de actividades según categoría.
- Indicador visual de desperdicio / completado / pendiente.
- En Modo Libre las actividades aparecen como bloques de duración sin hora fija.
- Compatibilidad total con el Modo Pausa (días en pausa aparecen atenuados o marcados).

---

### 6. Temporizador → Modal Flotante (ya no es módulo)

**Cambio de paradigma**:
- El Temporizador **deja de ser un módulo/pantalla independiente**.
- Se convierte en un **modal flotante (overlay)** que aparece automáticamente cuando el usuario inicia una actividad.

**Comportamiento**:
1. El usuario pulsa “Iniciar” en una actividad.
2. Se abre un modal centrado / flotante con:
   - Nombre de la actividad
   - Cuenta regresiva (sincronizada con hora real en Modo Sincrónico)
   - Tiempo transcurrido
   - Botones: Pausar, Finalizar, Posponer, Cancelar
3. Al finalizar o al cerrar el modal, se muestra el resumen de tiempo + puntos.
4. El modal puede minimizarse a un pequeño widget flotante (esquina inferior) si el usuario quiere seguir navegando.

**Ventaja**: Evita tener un módulo vacío y convierte el temporizador en una herramienta contextual y útil.

---

### 7. Estadísticas → Integradas en el Resumen (Dashboard)

**Cambio**:
- El módulo “Estadísticas Avanzadas” **deja de ser una sección separada**.
- Las estadísticas pasan a formar parte del **Dashboard / Resumen** (la primera pantalla que ve el usuario al entrar).

**Contenido del Dashboard actualizado**:
1. Resumen del día actual (actividades + estado)
2. Cadena actual y progreso
3. Estadísticas clave del día / semana / mes (gráficos pequeños)
4. Tiempo por categoría (hoy / esta semana)
5. % de cumplimiento
6. Accesos rápidos a Calendario, Actividades y Perfil

El usuario ve su progreso y estadísticas **inmediatamente** al abrir la app.

---

### 8. Inicio de Sesión Rápido mediante QR

**Nueva funcionalidad de autenticación**:

- Cada usuario puede generar un **QR temporal** desde su página de Perfil.
- El QR contiene únicamente un token aleatorio opaco; nunca incluye correo, contraseña, hash, salt ni otras credenciales.
- Características de seguridad:
  - El token es de un solo uso o de corta duración (recomendado: 5-15 minutos de validez o uso único).
  - Al generar un QR nuevo se revocan los QR pendientes anteriores del usuario.
  - El QR se regenera bajo demanda (“Generar nuevo QR”).
  - En el login se añade la opción: **“Iniciar sesión con QR”**.
  - Flujo:
    1. El usuario abre TimeLock-v en un dispositivo nuevo.
    2. Selecciona “Iniciar sesión con QR”.
    3. Escanea el QR desde el navegador del dispositivo nuevo usando la cámara, o introduce el token/enlace manualmente.
    4. Se valida el token en el servidor y se crea la sesión.

**Recomendaciones de seguridad** (basadas en investigación 2025-2026):
- Generar el token en el servidor (nunca en el cliente).
- Usar tokens aleatorios de un solo uso y corta vida; el servidor guarda únicamente el hash SHA-256.
- La reclamación usa una actualización condicional atómica (`usedAt = null` y `expiresAt > ahora`) para impedir reutilización concurrente.
- Las respuestas de generación/consumo usan `Cache-Control: no-store`.
- Mostrar claramente la validez del QR y revocar los pendientes al generar uno nuevo.
- Opción de revocar todos los QR activos desde Ajustes de seguridad.

**Escaneo, descargas y limitaciones implementadas**:

- El login incluye escaneo en navegador mediante `html5-qrcode`, con cámara trasera preferida, solicitud de permisos, botón de cancelación y mensajes para permisos rechazados, QR inválido o cámara no disponible.
- El escaneo solo acepta enlaces `/login?qr=...` del mismo origen de TimeLock-v; no acepta códigos de sitios externos.
- Perfil permite descargar el QR como PNG y como PDF usando `qrcode` y `jspdf`. Los archivos contienen el QR bearer temporal: deben tratarse como una credencial de corta duración y no compartirse públicamente.
- El navegador debe ejecutarse en HTTPS (o `localhost`) para permitir cámara. El escaneo depende de la compatibilidad de cámara del navegador y no sustituye un lector nativo.
- El QR caduca a los 10 minutos, solo puede consumirse una vez y, si dos dispositivos intentan usarlo simultáneamente, solo una reclamación obtiene sesión.

---

### 9. Resumen de Cambios Estructurales (Lista Final de Módulos)

**Módulos / Pantallas actualizadas**:

1. Landing / Homepage (público)
2. Auth (Login / Register + opción QR)
3. Onboarding
4. **Dashboard / Resumen** (incluye estadísticas + actividades del día)
5. Actividades (Diario + Semanal)
6. **Calendario** (vistas Día / Semana / Mes)
7. Sugerencias Inteligentes
8. Recompensas
9. Sistema de Cadena Diaria
10. **Perfil de Usuario** (separado + foto + QR)
11. **Ajustes** (incluye Modo Pausa + tema + idioma + modo de operación)
12. Exportador de PDF

**Eliminados como módulos independientes**:
- Temporizador (ahora modal flotante)
- Estadísticas Avanzadas (integradas en Dashboard)
- Modo Viaje (ahora opción “Modo Pausa” en Ajustes)

---

### 10. Notas de Implementación Prioritarias

1. Corregir i18n primero (afecta toda la experiencia).
2. Separar Perfil y Ajustes.
3. Implementar subida de foto de perfil.
4. Convertir temporizador en modal.
5. Integrar estadísticas en Dashboard.
6. Mejorar calendario con 3 vistas.
7. Renombrar y mover “Modo Pausa”.
8. Añadir sistema de QR de login seguro.

---

**TimeLock-v v1.2** queda más limpio, más intuitivo y más alineado con las mejores prácticas de apps de productividad modernas.

¿Quieres que genere a continuación el esquema de base de datos actualizado, los wireframes de las nuevas pantallas (Perfil, Ajustes, Dashboard, Login con QR) o el código base de alguna de estas mejoras?

Solo indícame el siguiente paso.
