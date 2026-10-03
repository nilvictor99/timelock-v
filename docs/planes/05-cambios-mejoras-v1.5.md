# TimeLock-v – Documento de Cambios v1.5
## Corrección de navegación en Perfil/Ajustes + Refactorización + Unificación de tarjetas

**Fecha:** 8 de septiembre de 2026  
**Versión:** 1.5 (delta sobre v1.4)  
**Referencia:** Aplica sobre los documentos v1.0, v1.1, v1.2, v1.3 y v1.4 ya existentes.

---

## Cambios solicitados

### 1. Corregir navegación aislada en Perfil y Ajustes

**Qué cambiar:**  
Actualmente, cuando el usuario está en `/dashboard/profile` o `/dashboard/settings` y hace clic en cualquier otro módulo de la barra lateral (Calendario, Actividades, Recompensas, etc.), en lugar de navegar a ese módulo, la app lo redirige al inicio (`/dashboard`). Los demás módulos (Resumen, Actividades, Sugerencias, Recompensas, Calendario, Cadena diaria, Exportar) sí navegan correctamente entre sí.

**Cómo cambiarlo:**  
- Identificar la causa raíz: probablemente existe un layout anidado en `app/dashboard/profile/layout.tsx` o `app/dashboard/settings/layout.tsx` que está rompiendo la navegación, o los links de la sidebar están usando rutas relativas en lugar de absolutas cuando se renderizan dentro de esas rutas.
- Asegurar que todos los links de la sidebar usen rutas absolutas (ej: `/dashboard/calendar`, no `../calendar`).
- Si existe un layout anidado que esté envolviendo el contenido de Perfil o Ajustes de forma diferente al layout padre, eliminarlo o unificarlo para que use exactamente la misma estructura que los demás módulos.
- Verificar que el componente de la sidebar sea el mismo en todas las rutas (no duplicado). Si está duplicado, refactorizar para reutilizar un solo componente.
- Probar que desde Perfil y Ajustes se pueda navegar a cualquier otro módulo sin redirección al inicio.

---

### 2. Refactorización de componentes para evitar código duplicado

**Qué cambiar:**  
Existen componentes duplicados o redundantes entre los módulos de Perfil, Ajustes y los demás módulos del dashboard.

**Cómo cambiarlo:**  
- Identificar componentes duplicados (ej: tarjetas, formularios, botones, inputs) y extraerlos a componentes reutilizables en `components/ui/` o `components/shared/`.
- Si la sidebar está duplicada en diferentes layouts, crear un solo componente `Sidebar` o `DashboardNav` y reutilizarlo.
- Si los layouts de Perfil y Ajustes tienen estructura similar a los demás módulos pero con pequeñas diferencias, unificarlos en un solo layout base con slots o props para personalización.
- Documentar brevemente qué componentes se refactorizaron y dónde quedaron.
- Asegurar que la refactorización no rompa ninguna funcionalidad existente.

---

### 3. Eliminar navegación interna "Volver" y link "Perfil" en Ajustes

**Qué cambiar:**  
En la pantalla de Ajustes (y posiblemente en Perfil) aparece en la parte superior un botón "← Volver" y un link "Perfil" (como se ve en las imágenes). Esto no es necesario porque ya existe la barra de navegación lateral que permite moverse entre módulos.

**Cómo cambiarlo:**  
- Eliminar el botón "← Volver" de la pantalla de Ajustes.
- Eliminar el link "Perfil" de la parte superior derecha de Ajustes.
- Si existe algo similar en Perfil (ej: link a Ajustes), eliminarlo también.
- La única forma de navegar entre módulos debe ser la barra lateral.

---

### 4. Unificar tarjetas "Información personal" y "Datos personales" en Perfil

**Qué cambiar:**  
En el Perfil existen dos tarjetas con contenido similar o redundante: "Información personal" y "Datos personales".

**Cómo cambiarlo:**  
- Fusionar ambas tarjetas en una sola llamada **"Datos personales"**.
- La tarjeta unificada debe contener todos los campos de ambas tarjetas originales sin duplicar campos.
- Mantener el botón "Guardar cambios" al final de la tarjeta unificada.
- Actualizar traducciones: eliminar las claves de la tarjeta que se elimina y unificar bajo un solo nombre.

---

### 5. Eliminar campo "Idioma" del Perfil

**Qué cambiar:**  
El campo "Idioma" existe tanto en Perfil como en Ajustes, lo cual es redundante.

**Cómo cambiarlo:**  
- Eliminar el campo "Idioma" (select de Español/Inglés) del módulo Perfil.
- Mantener el campo "Idioma" en Ajustes (ya existe y debe seguir funcionando).
- Si el idioma se guardaba en el perfil del usuario en la base de datos, mantener la columna pero solo se edita desde Ajustes.
- Actualizar traducciones: eliminar las claves relacionadas con idioma del archivo de traducciones del Perfil (si existen), mantenerlas en Ajustes.

---

## Restricciones

1. **NO eliminar** ninguna funcionalidad existente (QR, estadísticas, foto de perfil, modo pausa en Ajustes, etc.).
2. **NO romper** la navegación en los demás módulos (Dashboard, Actividades, Sugerencias, Recompensas, Calendario, Cadena diaria, Exportar).
3. **NO hardcodear** strings: todo debe pasar por `next-intl` (`useTranslations`).
4. **NO cambiar** el estilo visual general (Notion blanco/negro).
5. **NO usar** librerías nuevas sin justificar.
6. **Mantener** el Modo Libre / Sincrónico funcionando exactamente como está.
7. **Mantener** el Modo Pausa funcionando exactamente como está.
8. La refactorización debe ser incremental: no reescribir todo desde cero, solo extraer y reutilizar.
9. Validar todo con `zod` tanto en cliente como en servidor.
10. Respetar RLS (Row Level Security) de Supabase en todas las queries nuevas.

---

## Criterios de aceptación

- [ ] Desde `/dashboard/profile` y `/dashboard/settings` se puede navegar a cualquier otro módulo (Calendario, Actividades, etc.) sin ser redirigido al inicio.
- [ ] Los componentes duplicados han sido refactorizados y reutilizados.
- [ ] No existe el botón "← Volver" ni el link "Perfil" en la parte superior de Ajustes.
- [ ] No existe navegación interna redundante en Perfil (solo se usa la sidebar).
- [ ] El Perfil tiene una sola tarjeta "Datos personales" que unifica los campos de las dos tarjetas anteriores.
- [ ] El campo "Idioma" ya NO aparece en el Perfil.
- [ ] El campo "Idioma" SIGUE apareciendo en Ajustes y funciona correctamente.
- [ ] La app compila sin errores de TypeScript (`tsc --noEmit` limpio).
- [ ] No hay regresiones en los demás módulos.
