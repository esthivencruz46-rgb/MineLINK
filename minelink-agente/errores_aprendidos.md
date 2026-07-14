# Registro de errores aprendidos

> Mantenido por el agente. Se actualiza cuando un error no se resuelve al
> primer intento. LEER al inicio de cada sesión, antes de tocar código.

## Reglas ya conocidas del entorno (Windows de Esthiven)
- uvicorn debe ejecutarse DESDE la carpeta backend/ (error de working
  directory si se lanza desde la raíz)
- localhost puede resolver lento por IPv6 en Windows: usar 127.0.0.1
  en lugar de localhost en las URLs del frontend
- pip requiere --break-system-packages en este entorno
- Android Studio se instaló en `C:\Program Files\Android\Android Studio1`
  (con "1" al final — la instalación nueva quedó al lado de la vieja
  `Android Studio` en vez de sobreescribirla). Su JBR (Java 21) está en
  `Android Studio1\jbr\bin\java.exe` — usar esa ruta como JAVA_HOME para
  compilar el proyecto Android por línea de comandos.

---

## 2026-07-06 — Compilar el proyecto Android (Capacitor) por primera vez
**Síntoma:** `./gradlew assembleDebug` fallaba con "JAVA_HOME is not set",
luego con licencias de SDK no aceptadas, luego el `sdkmanager` viejo
tiraba `NoClassDefFoundError: javax/xml/bind/annotation/XmlSchema`.
**Causa raíz:** (1) no había JAVA_HOME configurado y Android Studio 4.1
(instalado originalmente) solo traía Java 8, insuficiente para Gradle
8.2.1/AGP 8.2.1 que exige Capacitor 6; (2) las licencias del SDK
Build-Tools 34 / Platform 34 nunca se habían aceptado; (3) el
`sdkmanager` clásico (`Sdk/tools/bin/sdkmanager.bat`) es una herramienta
vieja incompatible con Java moderno (usa `javax.xml.bind`, removido
desde Java 11).
**Solución aplicada:**
1. Se actualizó Android Studio a una versión reciente (2026.1.1, trae
   Java 21 en `jbr/`).
2. Se aceptaron las licencias escribiendo directamente los hashes
   conocidos y públicos de Google en
   `%LOCALAPPDATA%\Android\Sdk\licenses\android-sdk-license` (en vez de
   usar el `sdkmanager` viejo, que no corre con Java moderno).
3. Se compiló con:
   `JAVA_HOME="/c/Program Files/Android/Android Studio1/jbr" ./gradlew assembleDebug --no-daemon`
   (el flag `--no-daemon` evitó que un daemon de Gradle de un intento
   anterior interrumpiera la compilación).
**Cómo evitarlo:** antes de compilar un proyecto Android nuevo en esta
máquina, verificar JAVA_HOME apunte al JBR de la versión ACTUAL de
Android Studio (no a un JRE viejo), y que las licencias del SDK Level
que pide el proyecto (ver `android/build.gradle` → versión de AGP y el
`compileSdkVersion`) ya estén aceptadas.
**Estado:** RESUELTO — `assembleDebug` compila exitosamente, APK en
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 2026-07-06 — La app Android instalada no podía cargar datos del backend
**Síntoma:** la app abría bien (se veía Inicio), pero cualquier pantalla
que pidiera datos (ej. "Ver proyectos mineros") mostraba
"No pudimos cargar los proyectos" — sin importar que `curl 127.0.0.1:8000`
funcionara perfecto desde la PC.
**Causa raíz (3 problemas encadenados, cada uno tapaba al siguiente):**
1. Capacitor carga la app por defecto en `https://localhost` — el navegador
   bloquea que una página HTTPS pida datos a `http://10.0.2.2:8000`
   ("Mixed Content"), visible en `adb logcat` como
   `Capacitor/Console ... Mixed Content: ... has been blocked`.
2. Con eso resuelto, `uvicorn` seguía sin responder porque corría con
   `--host 127.0.0.1` (solo loopback) — el emulador llega por una interfaz
   de red distinta (NAT), aunque `10.0.2.2` "mapee" al host. `ping 10.0.2.2`
   desde el emulador SÍ respondía (ICMP no pasa por el puerto de la app),
   lo cual despistó — hay que probar el puerto específico, no solo ping.
3. Con `--host 0.0.0.0`, Android seguía bloqueando por **cleartext
   traffic**: desde API 28 (Android 9), las apps rechazan HTTP plano por
   defecto salvo que el manifest lo permita explícitamente. Este bloqueo
   NO deja rastro en `Capacitor/Console` (no hay logueo de JS), así que
   hay que pensarlo aunque los logs se vean limpios.
**Solución aplicada:**
- `frontend/capacitor.config.ts`: `server: { androidScheme: "http" }`.
- Backend de desarrollo: `uvicorn main:app --host 0.0.0.0 --port 8000`
  (no `127.0.0.1`) cuando se vaya a probar desde el emulador/celular.
- `frontend/android/app/src/main/AndroidManifest.xml`: agregar
  `android:usesCleartextTraffic="true"` en `<application>`.
- Después de cualquiera de estos cambios: `npm run android:sync` →
  recompilar (`gradlew assembleDebug`) → reinstalar
  (`adb install -r ...apk`) → `adb shell am force-stop` + relanzar (si no
  se hace force-stop, Android sigue usando la instancia vieja en memoria).
**Cómo evitarlo:** para cualquier app Capacitor que hable con un backend
HTTP local, aplicar los 3 puntos de la solución DESDE EL INICIO, no
esperar a que falle. Los 3 son necesarios en conjunto — arreglar solo uno
o dos no es suficiente y el síntoma (falla silenciosa de fetch) es igual
para los tres. `android:usesCleartextTraffic="true"` y `androidScheme:
"http"` son solo para desarrollo local; cuando el backend tenga HTTPS
real, hay que quitarlos.
**Estado:** RESUELTO — verificado con captura de pantalla mostrando los
3 proyectos reales cargados desde Supabase dentro del emulador.

---

## 2026-07-06 — SQLite endurecido para más tráfico concurrente
**Síntoma:** al pensar en escalar a ~100k personas / ~1000 minas, la BD no
tenía modo WAL ni índices en columnas de filtro/FK muy usadas
(operacion_id, region, mineral, bloqueado) — riesgo de "database is
locked" bajo escrituras simultáneas y de table scans en /proyectos.
**Causa raíz:** configuración por defecto de SQLite/SQLAlchemy, nunca
ajustada porque el volumen de datos en desarrollo era mínimo.
**Solución aplicada:** `database.py` activa `PRAGMA journal_mode=WAL` y
`PRAGMA busy_timeout=5000` en cada conexión; se agregaron índices vía
`seeds/migrar_indices_y_wal.py`; se agregó `seeds/backup_db.py` (backup
seguro con la API de sqlite3, conserva los últimos 14).
**Cómo evitarlo:** al agregar una tabla/columna nueva que se filtra o se
usa como FK en JOINs frecuentes, agregar `index=True` desde el inicio en
el modelo, no como migración tardía.
**Nota de arquitectura:** esto alivia el cuello de botella pero SQLite
sigue siendo un solo archivo con un solo escritor a la vez. El
CLAUDE.md raíz ya documenta "SQLite (Supabase en fase 2)" — si el
tráfico de escritura simultánea crece de verdad (cientos de registros/seg
en producción), migrar a Postgres/Supabase sigue siendo el paso correcto,
no solo seguir ajustando SQLite.
**Estado:** RESUELTO (para el nivel de tráfico actual)

---

## 2026-07-09 — /empresas mostraba vacío hasta que el usuario reseleccionaba "Todos los departamentos"
**Síntoma:** al entrar a /empresas justo después del diagnóstico, la
lista salía vacía; volver a elegir "Todos los departamentos" en el
select (mismo valor visual) la hacía aparecer.
**Causa raíz:** el diagnóstico nunca pregunta el departamento — guarda el
placeholder interno `"no especificado"` en `region` (ver
`Cuestionario.tsx` `SIN_ESPECIFICAR`). `Empresas.tsx` inicializaba su
filtro con `guardado?.region ?? ""`, así que en el primer render
`region` valía literalmente `"no especificado"` (string truthy, sin
`<option>` que lo represente — el `<select>` mostraba "Todos los
departamentos" pero el estado real era otro). Ese valor SÍ se mandaba
como query param al backend, que lo trataba como un departamento real en
`recomendar()` y descartaba todas las empresas (ninguna tiene "no
especificado" en `regiones_json`). Al reseleccionar "Todos los
departamentos" a mano, `region` pasaba a `""` (falsy) y el frontend
directamente OMITÍA el parámetro, activando la rama "sin filtro" del
backend — "arreglando" el síntoma por una razón distinta a la esperada.
**Solución aplicada:** `Empresas.tsx` trata `"no especificado"` como
`""` al inicializar el filtro. Además, `routers/empresas.py`
`listar_empresas` ahora usa `not estudios or not region` (en vez de
`is None`) para decidir si aplica el filtro, así un `region=""` explícito
se comporta igual que el parámetro ausente en vez de colarse hasta
`recomendar()`.
**Cómo evitarlo:** cuando un campo tiene un valor "placeholder" interno
(no un dato real vacío), nunca inicializar un `<select>`/filtro público
con ese placeholder directamente — normalizarlo a "sin selección" antes.
Y en endpoints con filtros opcionales, tratar `""` y `None` de forma
idéntica desde el principio, no solo `None`.
**Estado:** RESUELTO

<!-- Formato de nuevas entradas:

## [FECHA] — [título corto]
**Síntoma:** qué falló y en qué archivo/comando
**Causa raíz:** por qué ocurrió
**Solución aplicada:** qué se hizo
**Cómo evitarlo:** regla concreta
**Estado:** RESUELTO | PENDIENTE
-->

## 2026-07-14 — Capas GEOCATMIN invisibles en el mapa Leaflet (CORS doble)
**Síntoma:** en `MapaGeocatmin.tsx` (esri-leaflet `dynamicMapLayer` sobre
GEOCATMIN/INGEMMET) el mapa mostraba solo la base satelital: las capas de
catastro/geología no aparecían en el navegador, aunque las mismas URLs de
`export` devolvían PNG perfectos con curl/requests.
**Causa raíz:** el servidor de GEOCATMIN NO envía cabeceras CORS, y
esri-leaflet tropieza con eso DOS veces: (1) su modo por defecto pide el
export vía XHR `f=json` → bloqueado por CORS; (2) incluso con `f: "image"`,
`_renderImage` crea el `<img>` con `crossOrigin = options.useCors` (true
por defecto) → el navegador vuelve a exigir CORS sobre la imagen, esta
falla y `onOverlayError` QUITA la capa del mapa en silencio (sin nada en
pantalla ni excepción visible).
**Solución aplicada:** ambas capas llevan `f: "image"` **y**
`useCors: false`. Verificado con una página de reproducción local +
captura de Edge headless (`--headless=new --screenshot`), que también
sirvió para ver el error real (`layer.on("requesterror")`).
**Cómo evitarlo:** con cualquier servicio ArcGIS ajeno, comprobar primero
si responde `Access-Control-Allow-Origin` (GEOCATMIN: no). Si no lo hace,
esri-leaflet necesita SIEMPRE el par `f: "image"` + `useCors: false`.
Probar capas de mapa en un navegador real/headless, no solo con curl —
el fallo de crossorigin en `<img>` no existe fuera del navegador.
**Estado:** RESUELTO
