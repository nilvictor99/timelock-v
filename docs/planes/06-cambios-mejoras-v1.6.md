# TimeLock-v – Documento de Cambios v1.6
## Campo API Key en IA + Ancho de Ajustes + Guardado automático con revertir + Opción de limpieza en start.sh

**Fecha:** 8 de septiembre de 2026  
**Versión:** 1.6 (delta sobre v1.5)  
**Referencia:** Aplica sobre los documentos v1.0, v1.1, v1.2, v1.3, v1.4 y v1.5 ya existentes.

---

## Cambios solicitados

### 1. Agregar campo de API Key en Integración con IA

**Qué cambiar:**  
En el módulo de Ajustes, sección "Integración con IA", actualmente faltan los campos necesarios para establecer la conexión con el proveedor de IA. Solo se muestran Proveedor, Modelo, URL base personalizada, Temperatura y Máximo de tokens, pero no hay forma de ingresar la clave que autentica la conexión.

**Cómo cambiarlo:**  
- Agregar un campo **"API Key"** (o "Token de acceso") como primer campo de la sección, antes de "Proveedor".
- El campo debe ser de tipo `password` (texto oculto) con un botón para mostrar/ocultar el valor (icono de ojo).
- Agregar un botón **"Probar conexión"** al lado o debajo del campo que:
  - Haga una llamada mínima al proveedor seleccionado (ej: un request de prueba con el modelo configurado).
  - Muestre un toast verde "Conexión exitosa" o rojo "Error de conexión: [mensaje]".
  - Valide que la API key sea correcta antes de permitir guardar.
- Agregar un mensaje informativo en la parte superior de la sección: *"Por seguridad, las claves API no se guardan en la base de datos. Configura la clave en el entorno seguro del servidor antes de usar IA."* (este mensaje ya existe, mantenerlo).
- La API key debe guardarse de forma segura:
  - **Opción recomendada:** En variables de entorno del servidor (`.env.local`), no en la base de datos.
  - **Opción alternativa (si se quiere por usuario):** Cifrada en la base de datos con una clave maestra del servidor.
- Si el campo está vacío, el botón "Probar conexión" debe estar deshabilitado y mostrar un mensaje: "Ingresa una API key para probar la conexión".

---

### 2. Corregir ancho del contenido en Ajustes

**Qué cambiar:**  
El contenido del módulo Ajustes (`/dashboard/settings`) se renderiza con un ancho muy estrecho/delgado, a diferencia del módulo Perfil que sí ocupa correctamente el espacio disponible con su layout de dos columnas.

**Cómo cambiarlo:**  
- Revisar el contenedor principal de la página de Ajustes (probablemente en `app/dashboard/settings/page.tsx` o un componente `SettingsPage`).
- Cambiar el ancho máximo (`max-w`) del contenedor para que coincida con el usado en Perfil y en los demás módulos del dashboard.
- Si Perfil usa un grid de 2 columnas (`grid-cols-2` o similar), aplicar el mismo patrón a Ajustes para que las tarjetas se distribuyan en dos columnas cuando haya espacio suficiente.
- Asegurar que el padding lateral sea consistente con el resto de módulos.
- El layout debe ser responsive: en pantallas pequeñas (mobile) las tarjetas deben apilarse en una sola columna, en pantallas medianas/grandes deben usar 2 columnas.
- Verificar que el título "Ajustes" y el subtítulo "Preferencias" mantengan su posición y estilo actual.

---

### 3. Guardado automático con opción de revertir

**Qué cambiar:**  
Actualmente, en las tarjetas de Perfil y Ajustes, el usuario debe hacer clic en un botón "Guardar cambios" (o "Guardar sección") para persistir los datos. Esto es lento y poco moderno.

**Cómo cambiarlo:**

#### 3.1 Guardado automático (auto-save)
- Cada campo individual (input, select, textarea, switch) debe guardar su valor automáticamente cuando el usuario:
  - Pierde el foco del campo (`onBlur`), O
  - Deja de escribir por un tiempo determinado (debounce de 500-1000ms para textareas/inputs de texto), O
  - Cambia el valor en selects/switches (guardado inmediato).
- Al guardar automáticamente, mostrar un toast sutil o un indicador visual pequeño (ej: un check verde ✓ al lado del campo o un texto "Guardado" que aparece y desaparece).
- El guardado debe ser optimista: actualizar la UI inmediatamente y hacer el request al servidor en segundo plano. Si falla, mostrar toast de error y revertir el valor al anterior.

#### 3.2 Botón de revertir (undo)
- Cuando un campo se modifica (antes de guardarse o después), debe aparecer un botón pequeño **"Revertir"** (icono de flecha circular ↺ o texto "Deshacer") al lado del campo.
- El botón "Revertir" debe:
  - Restaurar el valor al último estado guardado en el servidor.
  - Desaparecer una vez que se revierte.
- El botón "Revertir" debe estar visible solo cuando el valor actual difiere del valor guardado.
- Para campos de texto largos (biografía, objetivos), el botón puede aparecer dentro del campo (esquina superior derecha) o debajo.

#### 3.3 Eliminación de botones "Guardar" manuales
- Eliminar los botones "Guardar cambios" y "Guardar sección" de todas las tarjetas de Perfil y Ajustes, ya que el guardado ahora es automático.
- Excepción: formularios complejos que requieren múltiples campos coordinados (ej: cambio de contraseña con 3 campos) pueden mantener un botón "Confirmar" dentro del modal, pero no en la tarjeta principal.

#### 3.4 Indicador de estado
- Agregar un indicador visual sutil en cada campo:
  - **Sin cambios:** estado normal.
  - **Modificado (no guardado):** borde ligeramente diferente o pequeño punto naranja al lado.
  - **Guardando:** spinner pequeño o texto "Guardando...".
  - **Guardado:** check verde ✓ temporal (desaparece después de 2 segundos).
  - **Error:** borde rojo + mensaje de error.

**Requisitos técnicos:**
- Usar `react-hook-form` con `watch()` para detectar cambios en tiempo real.
- Implementar debounce con `useDebouncedCallback` de `use-debounce` o similar.
- Para el estado "revertir", mantener en memoria el último valor confirmado del servidor.
- Los toasts deben ser sutiles (no invasivos), preferiblemente en la esquina inferior derecha con duración corta (2 segundos).

---

### 4. Agregar tercera opción al script start.sh

**Qué cambiar:**  
El script `scripts/start.sh` actualmente ofrece 2 opciones: Desarrollo (`npm run dev`) y Producción (`npm run build && npm start`). Se requiere una tercera opción que limpie todo antes de levantar el proyecto.

**Cómo cambiarlo:**  
Agregar una tercera opción **"Desarrollo limpio (reset completo)"** que ejecute, en este orden:

1. **Limpiar caché de Next.js:**
   ```bash
   rm -rf .next
   ```

2. **Limpiar caché de node_modules (opcional pero recomendado):**
   ```bash
   rm -rf node_modules/.cache
   ```

3. **Resetear base de datos (Supabase local o remota):**
   - Si usa Supabase local (Docker):
     ```bash
     supabase db reset
     ```
   - Si usa Supabase remoto o necesita migraciones desde cero:
     ```bash
     # Opción A: Drop y recreate de tablas (cuidado, borra datos)
     supabase migration up --db-url $DATABASE_URL
     
     # Opción B: Si hay seed data, ejecutar después del reset
     supabase db reset && supabase db seed
     ```
   - Si no usa Supabase CLI, proporcionar comando alternativo para limpiar la BD manualmente (ej: script SQL que haga TRUNCATE de las tablas principales).

4. **Reinstalar dependencias (opcional, solo si se detectan problemas):**
   ```bash
   npm install
   ```

5. **Ejecutar migraciones:**
   ```bash
   npx prisma migrate deploy  # si usa Prisma
   # o
   supabase migration up      # si usa Supabase CLI
   ```

6. **Levantar el proyecto en modo desarrollo:**
   ```bash
   npm run dev
   ```

**Menú actualizado del script:**
```
¿Cómo quieres iniciar TimeLock-v?
  1) Desarrollo (npm run dev)
  2) Producción (npm run build && npm start)
  3) Desarrollo limpio (reset completo de caché y BD)
Selecciona [1]:
```

**Advertencias importantes:**
- La opción 3 debe mostrar una advertencia clara antes de ejecutarse: *"⚠️ Esta opción eliminará todos los datos de la base de datos y la caché local. ¿Continuar? (s/n)"*.
- Solo debe ejecutarse en entorno local, nunca en producción.
- Si el usuario cancela, el script debe salir limpiamente sin hacer cambios.

---

## Restricciones

1. **NO eliminar** ninguna funcionalidad existente (QR, estadísticas, foto de perfil, modo pausa, etc.).
2. **NO romper** la navegación entre módulos.
3. **NO hardcodear** strings: todo debe pasar por `next-intl` (`useTranslations`).
4. **NO cambiar** el estilo visual general (Notion blanco/negro).
5. **NO usar** librerías nuevas sin justificar. Si se necesita `use-debounce` para el auto-save, justificarlo.
6. **Mantener** el Modo Libre / Sincrónico funcionando exactamente como está.
7. **Mantener** el Modo Pausa funcionando exactamente como está.
8. El guardado automático debe respetar RLS de Supabase.
9. La API key nunca debe exponerse en el cliente (solo en servidor).
10. El script start.sh debe funcionar en Linux (bash) y ser compatible con el entorno actual del usuario.

---

## Criterios de aceptación

- [ ] El módulo de Integración con IA tiene un campo "API Key" con botón para mostrar/ocultar.
- [ ] El botón "Probar conexión" funciona y valida la API key antes de guardar.
- [ ] El contenido de Ajustes ocupa el mismo ancho que Perfil y los demás módulos.
- [ ] Ajustes usa layout de 2 columnas en pantallas grandes (igual que Perfil).
- [ ] Los campos de Perfil y Ajustes guardan automáticamente al cambiar (onBlur o debounce).
- [ ] Aparece un botón "Revertir" cuando un campo ha sido modificado.
- [ ] Se eliminan los botones "Guardar cambios" y "Guardar sección" de las tarjetas.
- [ ] Hay indicadores visuales sutiles de estado (guardando, guardado, error).
- [ ] El script start.sh tiene 3 opciones, incluyendo "Desarrollo limpio".
- [ ] La opción 3 limpia caché, resetea BD y levanta el proyecto.
- [ ] La opción 3 muestra advertencia antes de ejecutar.
- [ ] La app compila sin errores de TypeScript (`tsc --noEmit` limpio).
- [ ] No hay regresiones en los demás módulos.
