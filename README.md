# TimeLock-v

Aplicación web de gestión de tiempo construida con Next.js 14, React, Tailwind CSS, PostgreSQL y Prisma. Incluye una landing pública, autenticación local, onboarding, dashboard privado, actividades programadas, temporizador, recompensas, calendario, estadísticas, cadena diaria, modo viaje, ajustes y exportación.

## Requisitos

- Node.js 20+
- Docker Desktop (opcional)
- PostgreSQL 14+ si se ejecuta sin Docker

## Ejecución local con PostgreSQL instalado

```bash
bash scripts/start.sh
```

Para iniciar directamente en producción, sin esperar la pregunta del menú:

```bash
bash scripts/start.sh production
```

El menú también ofrece `3) Desarrollo limpio`. Esta opción es exclusivamente local:
requiere confirmar `s`/`y`, elimina `.next` y `node_modules/.cache`, ejecuta
`npx prisma db push --force-reset` contra una PostgreSQL local y vuelve a cargar el
seed. **Borra todos los datos de esa base de datos**; rechaza hosts remotos y entornos
de producción, y no hace nada si se cancela la confirmación. No se debe usar como
comando de despliegue.

El script pregunta si quieres iniciar en modo desarrollo (`npm run dev`), producción (`npm run build` seguido de `npm start`) o desarrollo limpio, y muestra la URL con el puerto elegido para abrirla en el navegador. El servidor de producción usa el artefacto standalone generado por Next.js.

El script crea `.env` si no existe, instala dependencias, genera Prisma Client, aplica el esquema y ejecuta el seed antes de arrancar el servidor. Detecta automáticamente un puerto libre para Next.js. Este flujo es estrictamente local: no usa Docker. Si PostgreSQL no responde, intenta iniciar el servicio PostgreSQL del sistema y, si no existe, muestra la instrucción para instalarlo. Para Docker usa exclusivamente `npm run start:docker`.

Si PostgreSQL está iniciado pero aparece `P1000` o un error de autenticación, el servidor está funcionando pero el usuario configurado en `.env` no tiene la contraseña esperada. En una instalación local, corrige el usuario y la base de datos con:

```bash
sudo -u postgres psql
```

```sql
CREATE USER timelock WITH PASSWORD 'timelock';
ALTER USER timelock WITH PASSWORD 'timelock';
CREATE DATABASE timelock OWNER timelock;
\q
```

Si el usuario o la base de datos ya existen, los comandos correspondientes solo actualizan la contraseña o muestran el error de objeto existente; después vuelve a ejecutar `bash scripts/start.sh`. También puedes cambiar `DATABASE_URL` en `.env` para usar credenciales distintas.

## Ejecución con Docker

```bash
bash scripts/start-docker.sh
```

La aplicación queda disponible en `http://localhost:3000` y PostgreSQL en el puerto `5432`. El compose ejecuta `prisma db push` automáticamente al iniciar el contenedor de aplicación. También puedes usar `npm run start:docker`. No se incluyen secretos: las credenciales del ejemplo son únicamente para desarrollo local.

## Limpieza

Para eliminar los artefactos locales creados por el arranque:

```bash
bash scripts/clean.sh
```

Esto detiene el proceso local registrado por TimeLock-v y elimina `.next`, `node_modules`, `package-lock.json` y los metadatos de runtime. No detiene ni elimina PostgreSQL del sistema, Docker, contenedores ni servicios externos. Conserva `.env` si contiene configuración personalizada; solo lo elimina cuando coincide exactamente con `.env.example`.

Para detener los contenedores y borrar también el volumen de PostgreSQL:

```bash
bash scripts/clean-docker.sh
```

También están disponibles `npm run clean` y `npm run clean:docker`.

## Registros y checklist

Cada ejecución crea un archivo Markdown en `logs/`:

- `start-local-*.md`: puertos elegidos, archivos creados o reutilizados, PostgreSQL iniciado o reutilizado, comandos ejecutados y PID registrado.
- `start-docker-*.md`: puertos, contenedores, volumen, imagen y comando Compose utilizados.
- `clean-local-*.md` y `clean-docker-*.md`: checklist con `[x]` para cada recurso eliminado y `[ ]` para cualquier elemento que haya quedado pendiente.

Los registros se conservan como auditoría intencional. Los recursos temporales de ejecución se guardan en `.timelock-v/`; `clean.sh` gestiona el flujo local y `clean-docker.sh` gestiona exclusivamente el flujo Docker.

## Estructura

```text
src/app/              App Router, layout, estilos y API routes
src/components/       Dashboard y componentes UI reutilizables
src/lib/              Prisma y utilidades
prisma/               Esquema PostgreSQL y seed
docker-compose.yml    PostgreSQL + aplicación
Dockerfile            Build standalone de Next.js
```

## Autenticación y privacidad

El registro usa email y contraseña de al menos 12 caracteres, hash bcrypt, sesiones persistidas en PostgreSQL y cookies `HttpOnly`/`SameSite=Lax` (con `Secure` en producción). El middleware protege `/dashboard` y `/onboarding`; las API vuelven a validar la sesión en servidor y todas las actividades, categorías, recompensas y exportaciones se filtran por `userId`.

El primer acceso lleva a `/onboarding`, donde se configura nombre, zona horaria, idioma y modo de operación:

- **Sincrónico**: horarios exactos y temporizador regresivo.
- **Libre**: duración estimada, inicio flexible y sin desperdicio por pasar una hora.

## API incluida

- `POST /api/auth/register`: crea una cuenta y sesión.
- `POST /api/auth/login`: inicia sesión con rate limiting básico.
- `POST /api/auth/logout`: invalida la sesión en servidor.
- `GET /api/auth/me`: devuelve el usuario autenticado.
- `POST /api/auth/qr`: genera un token QR de un solo uso para el usuario autenticado.
- `POST /api/auth/qr-login`: consume un token QR y crea una sesión.
- `POST /api/profile/avatar`: valida y guarda un avatar local.
- `GET /api/bootstrap`: carga únicamente los datos del usuario autenticado.
- `POST /api/bootstrap`: crea actividades/recompensas o actualiza perfil, onboarding y modo.
- `PATCH /api/bootstrap`: cambia el estado de una actividad propia.
- `DELETE /api/bootstrap?id=...`: elimina una actividad propia.
- `GET /api/export`: exporta la agenda propia como CSV.

## Perfil y ajustes

`/dashboard/profile` y `/dashboard/settings` son pantallas independientes. El perfil contiene identidad, avatar, métricas y QR de inicio de sesión; ajustes contiene tema, idioma, modo de operación y Modo Pausa. El idioma se conserva en PostgreSQL, cookie y `localStorage`.

Los avatares se validan (JPG, PNG o WebP, máximo 5 MB) y se guardan en `public/uploads`. Si no existe una imagen se muestran las iniciales.

El Modo Pausa se persiste en el usuario y oculta la agenda del día mientras está activo; el banner permite volver a ajustes para reanudarla.

Desde **Perfil** cada usuario puede registrar su nombre, correo, descripción personal, país, ciudad y zona horaria. Estos datos se guardan en PostgreSQL junto con sus actividades, categorías, recompensas y progreso para personalizar su organización del tiempo.

La integración con IA guarda únicamente proveedor, modelo, URL y límites de uso en
PostgreSQL. La API key es efímera en el navegador y solo se envía al endpoint
servidor de prueba; nunca se persiste, se devuelve ni se registra. Para generar
sugerencias, configura la clave en el entorno seguro del servidor (no uses variables
`NEXT_PUBLIC_*`):

```dotenv
AI_PROVIDER=OPENAI
AI_BASE_URL=
OPENAI_API_KEY=...
# Alternativas: OPENROUTER_API_KEY, NVIDIA_API_KEY, ANTHROPIC_API_KEY,
# GEMINI_API_KEY, OLLAMA_API_KEY o CUSTOM_AI_API_KEY.
# Para un proveedor personalizado también puedes definir CUSTOM_AI_BASE_URL.
```

El botón **Probar conexión** valida una solicitud mínima con la clave introducida,
pero no convierte esa clave en configuración persistente. En producción, usa el
gestor de secretos de tu plataforma y reinicia el servidor cuando cambies una
variable.

El QR contiene únicamente un token aleatorio de un solo uso. El servidor almacena solo su hash, con una validez de diez minutos; nunca se incluyen credenciales.

## Pendientes fuera de esta iteración

OAuth (Google/Apple/GitHub), magic links, verificación de correo, recuperación de contraseña, MFA/passkeys, calendario externo, pagos, PWA/offline y notificaciones push requieren proveedores, credenciales o infraestructura adicional. El modelo de sesiones y el perfil dejan la arquitectura preparada para incorporarlos sin volver al usuario demo.
