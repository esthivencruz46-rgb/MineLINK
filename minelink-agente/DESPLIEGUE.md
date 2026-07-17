# Checklist de despliegue — Qorilink

Guía para el día que se contrate hosting (y opcionalmente dominio).
Todo el código ya está preparado: solo hay que pegar URLs en los lugares
marcados, sin tocar código.

## Qué se necesita contratar

| Pieza | Qué es | Opciones típicas |
|---|---|---|
| Hosting del backend | Servidor que corre FastAPI 24/7 | Railway, Render, Fly.io |
| Hosting del frontend | Sirve la página web (archivos de `npm run build`) | Vercel, Netlify |
| Dominio (opcional) | Nombre bonito (minelink.pe) que apunta a los hostings | NIC.pe, Namecheap |

La base de datos ya está en la nube (Supabase) — no hay que moverla.
Los hostings dan URLs gratis tipo `minelink.onrender.com`; el dominio
propio puede esperar.

## Paso 1 — Backend en su hosting

1. Subir la carpeta `backend/` al hosting. Comando de arranque:
   `uvicorn main:app --host 0.0.0.0 --port $PORT`
2. En el panel del hosting, definir las variables de entorno (NO subir el
   archivo `.env`): `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
   `SECRET_KEY` — copiar los valores del `backend/.env` local.
3. Anotar la URL pública que te da el hosting (ej. `https://minelink-api.onrender.com`).
4. Probar en el navegador: `https://TU-URL-BACKEND/health` debe responder `{"status":"ok"}`.

## Paso 2 — Frontend en su hosting

1. En `frontend/.env`: seguir las instrucciones de la sección
   "CUANDO TENGAS HOSTING/DOMINIO" (pegar la URL del backend del paso 1).
2. `npm run build` y subir la carpeta `dist/` a Vercel/Netlify
   (o conectar el repo y que el hosting corra el build solo).
3. Anotar la URL pública del frontend (ej. `https://minelink.vercel.app`).

## Paso 3 — Avisarle al backend quién es el frontend (CORS)

En las variables de entorno del hosting del backend, agregar:
`FRONTEND_URL=https://TU-URL-FRONTEND` (del paso 2). Reiniciar el backend.
Sin esto, la página web no podrá pedirle datos al backend.

## Paso 4 — Regenerar la app Android

1. `frontend/.env` ya quedó apuntando al backend público (paso 2).
2. Quitar los permisos de HTTP inseguro que solo eran para desarrollo
   (el hosting ya da HTTPS real):
   - `frontend/capacitor.config.ts`: borrar la línea `server: { androidScheme: "http" }`.
   - `frontend/android/app/src/main/AndroidManifest.xml`: borrar
     `android:usesCleartextTraffic="true"`.
3. `npm run android:sync` y recompilar el APK
   (`cd android && ./gradlew assembleDebug` con el JAVA_HOME del JBR,
   ver errores_aprendidos.md).
4. Ese nuevo APK ya funciona con CUALQUIER internet (datos móviles,
   cualquier WiFi) y se puede compartir por WhatsApp/Drive — cada persona
   solo debe aceptar "instalar de origen desconocido". No requiere Play Store.

## Paso 5 — Dominio propio (opcional, cuando se compre)

1. En el hosting del frontend: agregar el dominio (ej. `minelink.pe`) y
   seguir sus instrucciones de DNS.
2. En el hosting del backend: agregar un subdominio (ej. `api.minelink.pe`).
3. Reemplazar las URLs de los pasos 2 y 3 por las nuevas del dominio y
   repetir el paso 4 (recompilar el APK).

## Recordatorios de seguridad para ese día

- Cambiar `ADMIN_PASSWORD` por una contraseña más fuerte que la actual.
- Borrar las credenciales de admin escritas en `RUTAS.md`.
- Verificar que `SECRET_KEY` en el hosting sea la aleatoria (no la de ejemplo).

## Respaldo automático de la base de datos (julio 2026)

`.github/workflows/backup-db.yml` corre `pg_dump` contra la Supabase de
producción todos los días a las 3:00 am hora Perú y guarda el resultado
como artefacto de GitHub Actions (90 días de retención, el máximo
gratuito). Antes no había NINGÚN respaldo automático — si algo se borraba
o corrompía en Supabase, no había forma de recuperarlo.

**Paso pendiente (una sola vez, lo hace Esthiven porque requiere pegar la
contraseña de la base — el agente no debe manejar ese secreto):**

1. Ir a `github.com/esthivencruz46-rgb/MineLINK` → **Settings** → **Secrets
   and variables** → **Actions** → **New repository secret**.
2. Nombre: `DATABASE_URL_BACKUP`.
3. Valor: la misma cadena de conexión que ya está en `backend/.env` como
   `DATABASE_URL` (empieza con `postgresql://postgres...`).
4. Guardar. El workflow ya queda activo desde el próximo push — para
   probarlo sin esperar al día siguiente, ir a la pestaña **Actions** →
   "Respaldo diario de la base de datos" → **Run workflow**.

**Para recuperar un respaldo**: pestaña Actions → abrir la corrida que
generó el backup deseado → descargar el artefacto (un archivo `.dump`) →
restaurarlo con `pg_restore --clean --if-exists -d <DATABASE_URL> archivo.dump`
(requiere tener `postgresql-client` instalado localmente).

**Mejora opcional futura** (no implementada aún): en vez de usar la
cadena de conexión completa (dueño de la base), crear un rol de Postgres
de solo lectura exclusivo para el backup — reduce el daño posible si ese
secret se filtrara algún día. Se puede agregar después sin romper nada de
lo de arriba.
