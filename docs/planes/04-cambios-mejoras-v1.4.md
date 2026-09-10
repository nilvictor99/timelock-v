# TimeLock-v – Documento de Cambios v1.4
## Reorganización de Perfil y Ajustes + Barra superior unificada

**Fecha:** 8 de septiembre de 2026  
**Versión:** 1.4 (delta sobre v1.3)  
**Referencia:** Aplica sobre los documentos v1.0, v1.1, v1.2 y v1.3 ya existentes.

---

## Cambios solicitados

### 1. Barra superior en Perfil y Ajustes

**Qué cambiar:**  
Los módulos `/dashboard/profile` y `/dashboard/settings` actualmente no muestran la barra superior que sí tienen los demás módulos del dashboard.

**Cómo cambiarlo:**  
- Hacer que `/dashboard/profile` y `/dashboard/settings` rendericen la misma barra superior que el resto de módulos.
- La barra debe incluir (en orden, de izquierda a derecha):
  1. Fecha actual formateada (ej: "Hoy, martes, 8 de septiembre")
  2. Título del módulo ("Perfil" o "Ajustes")
  3. Badge de puntos (ej: "🏆 4 pts")
  4. Badge de modo de operación (ej: "Modo libre" / "Modo sincrónico")
  5. Avatar circular con inicial o foto del usuario
  6. Botón "Salir" (logout)
- Revisar `app/dashboard/layout.tsx` (o el layout padre correspondiente) para asegurar que la barra se renderice para todas las rutas hijas, incluyendo `profile` y `settings`.
- Si existe un layout anidado en `app/dashboard/profile/layout.tsx` o `app/dashboard/settings/layout.tsx` que esté omitiendo la barra, modificarlo para que extienda el layout padre en lugar de reemplazarlo.
- Mantener el estilo visual actual de la barra (fondo negro, tipografía sans-serif, avatar circular blanco con inicial, botón "Salir" en texto blanco).

---

### 2. Eliminar "Zona horaria" del Perfil

**Qué cambiar:**  
El campo "Zona horaria" está duplicado: aparece tanto en Perfil como en Ajustes.

**Cómo cambiarlo:**  
- Eliminar el campo "Zona horaria" (label, input y validación) del formulario de Perfil.
- **NO eliminar** la columna de la base de datos (sigue existiendo, solo se edita desde Ajustes).
- **NO eliminar** el campo de Zona horaria en Ajustes (debe seguir funcionando como hasta ahora).
- Actualizar traducciones: quitar las claves relacionadas con zona horaria de `messages/es.json` y `messages/en.json` **solo si no se usan en Ajustes**. Si se usan en Ajustes, mantenerlas.

---

### 3. Reorganizar tarjetas del Perfil

**Qué cambiar:**  
La tarjeta principal del Perfil mezcla foto + nombre + biografía + país + ciudad + zona horaria en un solo bloque. Se requiere separar en tarjetas distintas con una lógica más clara.

**Cómo cambiarlo:**

#### Tarjeta 1 — "Cuenta" (columna izquierda, arriba)
- Foto de perfil (avatar circular grande) + botón "Subir foto" (mantener comportamiento actual).
- **Campo "Correo electrónico"**: un solo input que muestre el correo actual del usuario y permita borrarlo y escribir uno nuevo.
  - Al lado del input, un botón "Actualizar correo".
  - Validación: formato de email válido + no puede estar en uso por otro usuario.
  - Pedir la contraseña actual antes de confirmar el cambio de correo (modal de confirmación).
- **Botón "Cambiar contraseña"**: al hacer clic, abre un modal con tres campos:
  1. Contraseña actual
  2. Nueva contraseña (mínimo 12 caracteres, con indicador de fortaleza)
  3. Confirmar nueva contraseña
  - Validación con `zod`.
  - Al guardar, mostrar toast de éxito y cerrar el modal.

#### Tarjeta 2 — "Información personal" (columna izquierda, debajo de Tarjeta 1)
- **Nombre / Apodo** (input de texto, ya existía)
- **Biografía** (textarea, ya existía)
- **País** (input de texto, ya existía)
- **Ciudad** (input de texto, ya existía)
- Botón "Guardar cambios" al final de la tarjeta.

#### Tarjeta 3 — "Estadísticas de cuenta" (columna derecha, arriba)
- Mantener exactamente como está: Días activos, Cadena actual, Puntos totales, Tiempo registrado.

#### Tarjeta 4 — "Seguridad" (columna derecha, medio)
- Mantener exactamente como está: texto de validez, botón "Generar nuevo QR", QR generado, botones de descarga, advertencia.

#### Tarjeta 5 — "Idioma" (columna derecha, abajo)
- Mantener exactamente como está: select de idioma (Español / Inglés).

**Layout visual (grid 2 columnas):**