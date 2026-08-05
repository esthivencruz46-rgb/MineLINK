# MineLink — Motor de Búsqueda de Formalización Minera

## Objetivo del proyecto
Plataforma web donde un minero artesanal peruano:
1. Responde el **diagnóstico de formalización** (fuente de verdad:
   `context/diagnostico_formalizacion.md`; ejecutable:
   `backend/catalogo_diagnostico.py` + `backend/scoring.py`): 4 preguntas
   filtro (M0) lo ubican en su perfil exacto del pipeline —
   **A** "desde cero" / **A_avanzado** "petitorio en trámite" /
   **B** "concesionario sin operar" / **C** "opera con REINFO" /
   **D** "formal pleno" / **SIN RUTA** (opera sin amparo legal: página
   informativa, sin cuenta ni POST) — y responde SOLO el módulo de su
   perfil. La salida son DOS semáforos independientes (Track Legal y
   Track Técnico con Índice de Madurez 0-5) + un checklist de su etapa +
   sus brechas. Regla de oro: SOBREVIVIR → ORDENAR → CRECER.
2. Ve las empresas y consultores que hacen EXACTAMENTE los estudios que
   le faltan (brecha→estudio→`Empresa.estudios_json`), o se postula él
   mismo como consultor (el formulario solo ofrece estudios que una
   pregunta actual puede generar — `ESTUDIOS_CON_PREGUNTA`). El WhatsApp
   de la empresa NO es público: el minero deja su interés
   (`POST /empresas/{id}/interes`) y Esthiven intermedia desde /admin.
3. Se registra (nombre, WhatsApp, departamento obligatorio, nombre de su
   operación, usuario/contraseña + pregunta de seguridad para recuperar
   contraseña solo) y vuelve a entrar por `/ingresar` → `/mi-cuenta`
   (perfiles C/D) o `/mi-concesion` (A/B).
4. Desde su cuenta: **"Respalda tu declaración"** — un slot de foto por
   cada estudio que declaró tener (`estudios_aplicables`; el perfil D
   además sube su credencial `autorizacion_drem`), con fechas y datos
   estructurados junto a los archivos (ley del mineral, minerales/
   litología, reservas, costo por TN, maquinaria, trabajadores →
   `datos_formalizacion_json`). Todo PDF se convierte a foto de su
   primera hoja (nunca se sirve un PDF crudo). En "Lo que te falta" cada
   brecha tiene "Ya lo tengo — subir respaldo": subir el archivo la
   resuelve solo (evidencia primero, sin aprobación del admin). Al enviar
   sus documentos se abre el **Módulo INV** (`catalogo_inversion.py`,
   wizard modal): bloque común INV_0 + bloque por perfil, con sus propios
   respaldos y brechas. Una campanita de notificaciones le avisa de
   novedades.
5. **Publicación automática**: con perfil B/C/D, semáforo legal ≠ rojo y
   AMBAS partes enviadas (documentos + Módulo INV), el proyecto aparece
   en `/proyectos` — sin visto bueno manual. La cartera muestra tarjetas
   con los dos **scores 0-100 por track** (`score_formalizacion` anclado
   a la etapa, `score_inversion`), chip "✓ Ventas verificadas", la
   mini-foto de la **credencial** que prueba que existe (autorización
   DREM / título de concesión) y selector de orden. SIN datos de contacto.
6. La **ficha pública** (`/proyectos/{id}`): mosaico superior con la
   ubicación en vista SATELITAL (parte ancha) + fotos de presentación
   (julio 2026: sin ningún panel de texto GEOCATMIN al costado de esas
   fotos — se probó un resumen ahí y se quitó por completo, pedido
   explícito: repetía lo mismo que ya dice completo más abajo); orden de
   las tarjetas de contenido (julio 2026, reordenado a pedido explícito):
   Resumen Ejecutivo → "Oportunidad de inversión" (respuestas públicas
   del INV: capital, % a ceder, deudas, estructura legal...) →
   **"Cotejo con registros públicos"** (GEOCATMIN/INGEMMET: concesión
   del catastro minero + geología del punto, caché 30 días, siempre
   referencial) → "Datos de la operación" → checklist de Formalización
   SOLO con los estudios de su perfil (tarjetas grandes de documento con
   sello "Verificado" + visor con flechas; lo pendiente en chips) →
   Documentos de inversión. Indicadores verificados en el panel lateral;
   descarga de ficha en PDF (jsPDF, 2 páginas). El
   mapa interactivo de la ficha (`MapaGeocatmin.tsx`) también puede
   mostrar, como capas opcionales georreferenciadas (julio 2026,
   `backend/copernicus.py`, DESACTIVADO por defecto —
   `MINELINK_COPERNICUS=1` + credenciales de Copernicus Data Space
   Ecosystem en Render), anomalías espectrales minerales calculadas con
   Sentinel-2 sobre el POLÍGONO REAL de la concesión: óxidos de hierro,
   arcillas, hierro ferroso, arcilla/sulfatos/mica (fórmulas del
   repositorio curado "awesome-mining-band-ratio"), "combinado" (superpone
   los 4) y "coincidencias" (julio 2026: píxeles donde 2+ índices
   coinciden a la vez, señal más confiable, gratis — se calcula de las
   máscaras ya obtenidas, sin llamada extra a Sentinel Hub). Cada índice
   solo pinta el 10% más alto (percentil relativo, se recalcula por
   proyecto) — el resto queda transparente; NO es una clasificación fina
   de alteración hidrotermal (propilítica/argílica/filítica), eso
   necesitaría ASTER (evaluado y descartado por costo — ver más abajo).
   "combinado" arranca de un lienzo TRANSPARENTE, igual que los demás —
   antes traía su propia foto RGB de fondo y tapaba el mapa entero al
   activarlo (bug real, corregido julio 2026 tras reporte con captura).
   `copernicus.VERSION_CACHE` hay que subirlo cada vez que cambia la
   forma de lo que devuelve una capa, o el caché ya guardado sigue
   sirviendo la versión vieja hasta `DIAS_REFRESCO` (90 días) — mordió
   dos veces en julio 2026. Se genera en segundo plano igual que
   GEOCATMIN/REINFO (primera visita = None, background task cachea,
   segunda visita ya sirve las 6 imágenes PNG desde storage) para no
   gastar créditos de Sentinel Hub en cada carga de la ficha — caché de
   90 días. Dentro del mismo pane de Leaflet que geología, cualquier capa
   nueva necesita su propio `zIndex` por encima de geología (10/11) o
   geología la tapa en silencio cuando ambas están activas.
   **Interpretación de esas capas por IA** (`backend/interpretacion_ubicacion.py`,
   julio 2026, pedido explícito de Esthiven — "para mi propio uso", no
   para inversionistas; metodología de análisis AMPLIADA agosto 2026, con
   los pasos exactos que Esthiven pidió cruzar). Usa Gemini (misma API key
   que `asesor.py`, `GEMINI_API_KEY` — el único proveedor conectado con
   visión en su nivel gratis) con hasta 8 imágenes + texto como entrada,
   en este orden fijo (ver `interpretacion_ubicacion._SYSTEM`):
   1. **Litología y fallas de GEOCATMIN, como TEXTO** (`geocatmin.resumen_para_ia`)
      — en qué unidad litológica cae la concesión (carta 1:50,000 si
      INGEMMET la tiene ahí, si no 1:100,000 — se indica cuál) y qué
      fallas geológicas hay cerca. Esto ya llega estructurado de INGEMMET,
      no hace falta que la IA "lea" una imagen para esto.
   2. **ASTER 9-3-1 de GEOCATMIN** (`geocatmin.imagenes_analisis_ia`) — se
      usa SOLO para juzgar roca expuesta vs. vegetación: toda anomalía
      (de GEOCATMIN o de Copernicus) que cae sobre roca expuesta es una
      señal más confiable; sobre vegetación, más débil (el follaje
      contamina la lectura del suelo) — regla dura del prompt, nunca se
      salta este cruce.
   3. **Anomalías Espectrales oficiales de GEOCATMIN** (mismo
      `imagenes_analisis_ia`, polígonos ya clasificados por INGEMMET:
      óxidos/arcillas/óxidos y arcillas) — se le pide decir explícitamente
      si algo de esto cae dentro de la concesión.
   4. **Las 6 capas de Copernicus** (como antes) — además se le pide
      señalar si distintos índices aparecen en zonas DISTINTAS de la
      concesión (ej. "óxidos al norte, arcillas al sur"), sin forzar una
      interpretación geológica que estos datos no permiten.
      Las 8 imágenes (2 de GEOCATMIN + 6 de Copernicus) llevan el borde de
      la concesión dibujado encima, color cian (no aparece en falso-color
      natural ni en los colores de los índices) — `geocatmin._con_borde_concesion`
      y `copernicus._con_borde_poligono` respectivamente. Necesario porque
      TODAS estas imágenes son el bounding box rectangular del polígono
      (nunca el polígono real recortado en la forma exacta de la
      concesión, que casi nunca es un rectángulo) — sin el contorno
      dibujado encima no hay forma de saber qué parte de la imagen es la
      concesión real y qué parte es solo el margen del bbox (agosto 2026,
      reportado en vivo para las capas de Copernicus específicamente: "no
      se puede distinguir en qué área del polígono catastral"; sube
      `copernicus.VERSION_CACHE` a 4 para que las capas ya generadas se
      regeneren solas con el borde nuevo, mismo mecanismo que cualquier
      otro cambio de forma de esas capas).
   **Escala/encuadre de las imágenes de GEOCATMIN (ASTER, Anomalía
   Espectral, Catastro+geología+fallas), segunda corrección agosto 2026**:
   la primera corrección (centrar el bbox en el polígono, no en el pin —
   ver más abajo) dejó la concesión bien centrada pero forzada al aspecto
   PANORÁMICO fijo de la portada del PDF (`_ASPECTO_PDF ≈ 2.87:1`,
   pensado para el recuadro ancho de portada) — cuando el polígono real es
   más angosto que ese panorama, sobraba mucho margen vacío a los
   costados. Comparado en vivo contra las capas de Copernicus (que sí
   llenan el cuadro, porque su bbox es el bounding box EXACTO del
   polígono sobre un lienzo cuadrado) y reportado explícitamente: "no está
   centrando bien... quiero que el gráfico sea igual que el de Anomalías
   Espectrales (GEOCATMIN) en esa escala". `geocatmin._bbox_ajustado_poligono`
   (centraba en el polígono, aspecto fijo) fue reemplazada por
   `_bbox_y_tamano_ajustado_poligono`, que devuelve TANTO el bbox como el
   tamaño de lienzo en píxeles — generado AL aspecto real del propio
   polígono (`_LADO_ANALISIS=1000px` de lado mayor, con un piso
   `_LADO_ANALISIS_MIN=480px` para no dejar el lienzo demasiado angosto en
   concesiones muy alargadas) en vez de forzar el bbox al aspecto del
   lienzo — así la concesión llena el cuadro completo sin distorsión, sea
   cual sea su forma. Solo aplica a la galería de análisis; la portada del
   PDF sigue con `_bbox_de`/el lienzo panorámico fijo, sin tocar (no
   necesita cambiar: ahí el pin SIEMPRE debe quedar dentro de cuadro,
   distinto objetivo). `_exportar_capa`/`_exportar_imagen_server` ahora
   aceptan un `tamano` opcional (por defecto el panorámico de portada);
   `_con_borde_concesion` lee `imagen.size` en vez de asumir el tamaño fijo
   global, porque ahora no todas las imágenes miden lo mismo.
   **Copernicus unificado al mismo criterio (agosto 2026, misma sesión)**:
   tras ver el resultado en vivo, Esthiven aclaró la dirección real: no era
   GEOCATMIN el que debía copiar a Copernicus, sino AL REVÉS —
   "las fotos de Copernicus [deben ser] como la de ASTER 931 o Anomalías
   Espectrales... todas las capas deben ser iguales a esas". Copernicus
   usaba su propio `bbox_de_poligono` (bounding box EXACTO del polígono,
   sin margen) sobre un lienzo CUADRADO fijo `_TAMANO_PX=(800,800)` —
   distorsionaba/desencuadraba cualquier concesión que no fuera
   aproximadamente cuadrada. Reemplazado por `bbox_y_tamano_de_poligono`
   (duplicada en `copernicus.py`, no importada de `geocatmin.py` —
   mismo criterio ya establecido para `_COLOR_BORDE_CONCESION`: los dos
   módulos son best-effort independientes): mismo margen chico + lienzo
   al aspecto real del bbox que ya usa GEOCATMIN, con su propio tope
   `_LADO_PX_MAX=800`/`_LADO_PX_MIN=400` (se mantuvo en 800, no se subió a
   los 1000 de GEOCATMIN, porque cada píxel de Copernicus consume cuota
   real de Sentinel Hub — subir el tope habría subido el costo por
   concesión). `_pedir()`/`SentinelHubRequest` ahora reciben ese tamaño en
   vez del `_TAMANO_PX` fijo; `_con_borde_poligono` ya leía `imagen.size`
   dinámicamente, no necesitó cambios. `copernicus.VERSION_CACHE` subido a
   5 (el bbox/encuadre de las 6 capas cambió) para que el caché ya
   generado con el encuadre viejo se regenere solo en vez de seguir
   sirviendo el mal encuadre hasta los 90 días de `DIAS_REFRESCO`.
   **Capas de Copernicus compuestas sobre satélite, SOLO para el PDF
   (agosto 2026, mismo hilo)**: aun con el bbox correcto, las 6 capas de
   Copernicus (transparentes salvo la anomalía, sin fondo) se veían como
   manchas de color flotando en blanco dentro de la galería del PDF —
   sin el mapa interactivo de Leaflet debajo (que sí aporta el contexto
   satelital en vivo), no había forma de ubicar la anomalía en el
   terreno. Comparado en vivo contra cómo se ve la MISMA capa superpuesta
   en el mapa interactivo (satélite + polígono + pin, todo legible) con
   la instrucción explícita "así quiero que estén las capas, todas".
   Nueva `copernicus.imagen_con_satelite(capa_bytes, bbox)`: toma la capa
   YA cacheada (con su borde de concesión ya dibujado) y la compone sobre
   una base satelital de Esri (misma fuente gratis que ya usa GEOCATMIN,
   sin costo de cuota de Sentinel Hub) — nuevo endpoint
   `GET /proyectos/{id}/anomalias-pdf/{capa}.png`, generado AL VUELO en
   cada pedido (como `geocatmin-analisis`: la llamada a Esri es gratis,
   solo se pide al descargar un PDF) reusando el PNG ya cacheado, sin
   volver a gastar créditos de Sentinel Hub. `ProyectoDetalleOut.anomalias_satelitales`
   ahora expone DOS diccionarios de URLs — `capas` (transparente, la de
   siempre) y `capas_pdf` (compuesta) —; `pdfProyecto.ts` usa `capas_pdf`
   para su galería. **El mapa interactivo (`MapaGeocatmin.tsx`) sigue
   usando `capas` tal cual, sin tocar** — ahí SÍ hay un basemap satelital
   vivo debajo (los tiles del propio Leaflet), así que componerle una
   foto satelital de nuevo sería reintroducir literalmente el bug de
   julio 2026 ya corregido ("solo pido los colores, no la imagen de
   fondo... eso también lo agarras y no quiero eso") — la separación en
   dos diccionarios de URLs existe exactamente para no volver a mezclar
   esos dos casos de uso.
   **Las 9 imágenes de la galería llevan SIEMPRE el polígono de la
   concesión (agosto 2026, requisito repetido de Esthiven: "tienen que
   salir en todas las capas el polígono de concesión... TODAS")**: 1
   catastro+geología+fallas, 2 ASTER 9-3-1, 3 Anomalías Espectrales, 4-9
   las 6 de Copernicus. ASTER/Anomalías y las de Copernicus ya lo tenían;
   faltaba la de catastro, que solo mostraba los contornos azules con que
   INGEMMET pinta TODAS las concesiones de la zona, sin distinguir cuál es
   la del proyecto — `imagen_mapa_cotejo` ganó un flag `con_borde` (por
   defecto False: la PORTADA del PDF no lo lleva, es otro uso) que
   `imagen_analisis_catastro` pasa en True.
   **Encuadre con contexto alrededor (agosto 2026, mismo hilo)**: el
   `margen` de la primera versión (1.12) dejaba el polígono pegado al
   borde del cuadro — pedido explícito: "que capte el total del polígono
   ... y unos menos más lejos para que se vea bien". Ahora
   `geocatmin._MARGEN_ANALISIS = 2.5` (la concesión ocupa ~40% del ancho y
   se ve el terreno que la rodea; se probó en vivo a 1.8 y 2.1, y Esthiven
   cerró en 2.5). Alejar más NO cuesta tiempo extra gracias al tope
   `copernicus._LADO_BASE_MAX` (ver abajo); sin ese tope, subir la
   expansión disparaba el tamaño del lienzo y el timeout volvía a romper
   el endpoint. En Copernicus la ampliación se aplica
   SOLO al componer la imagen del PDF (`copernicus._EXPANSION_PDF`, la
   capa ya calculada se PEGA centrada dentro de una foto satelital más
   amplia, sin estirarse), NUNCA al bbox con que se calculan los índices:
   el umbral de cada capa es el percentil 90 DENTRO del área analizada,
   así que analizar un área mayor convertiría "más óxido que el resto de
   la concesión" en "...que el resto de la región" — otro dato, no el
   mismo dato mejor encuadrado.
   **Timeout de la base satelital (agosto 2026, bug real en producción)**:
   con la vista ampliada, la foto de Esri pasó a pesar 2.77 MB en `png32`
   y tardaba ~13s, más que los 12s de timeout que tenía
   `imagen_con_satelite` — el endpoint devolvía SIEMPRE
   `404 "No se pudo componer la base satelital"` en Render (localmente
   pasaba, de ahí que no se notara sin probar contra producción). Se pide
   en `format=jpg` (0.47 MB, ~6x menos: la base es opaca, no necesita
   canal alfa) y `_TIMEOUT_SATELITE = 40` — es una llamada que solo ocurre
   al descargar un PDF, nunca en una carga de ficha, así que puede
   permitirse ser lenta.
   **Paginación de la galería en el PDF (agosto 2026, causa raíz de
   "tampoco hay la interpretación de la IA... dentro del PDF")**: la
   grilla de 9 capas ocupa ~230mm y en una A4 solo hay ~255mm útiles, así
   que reservar la grilla COMPLETA de una vez (con `asegurarEspacio`)
   forzaba SIEMPRE un salto de página — el título "Análisis satelital
   (IA)" y el párrafo de la IA quedaban solos al pie de la página
   anterior y la grilla arrancaba sola en la siguiente, que se leía como
   que la interpretación no se estaba generando. `pdfProyecto.ts` ahora
   avanza fila por fila y salta de página solo cuando la fila siguiente no
   entra.
   Reglas duras que se mantienen: nunca afirma presencia de mineral ni ley
   (solo "señal a investigar"), nunca hace una clasificación fina de
   alteración hidrotermal (ni Sentinel-2 ni ASTER 9-3-1 así usado tienen
   las bandas para eso), destaca explícitamente si "Coincidencias" tiene
   algo pintado (la señal más fuerte de las 6 de Copernicus). Respuesta:
   1-2 párrafos, hasta 8 oraciones (se relajó desde "3-5 oraciones" de
   julio 2026 — cruzar todas estas fuentes en un solo párrafo corto forzaba
   superficialidad).
   DESACTIVADO por defecto, `MINELINK_INTERPRETACION_UBICACION=1` (además
   de `MINELINK_COPERNICUS=1`, del que depende). Se genera en el mismo
   background task que las capas de Copernicus
   (`_refrescar_anomalias_en_segundo_plano` en `routers/proyectos.py` — es
   el único momento en que los bytes PNG de Copernicus están en memoria;
   las imágenes de GEOCATMIN se piden aparte ahí mismo, vía
   `geocatmin.imagenes_analisis_ia`) y se cachea junto a ellas en
   `datos_formalizacion_json["_interpretacion_ubicacion"]`. Dos campos de
   versión separados, a propósito: `"v"` sigue compartido con
   `_anomalias_satelitales` (invalida si las capas de Copernicus cambian
   de forma); `"v_prompt"` es `interpretacion_ubicacion.VERSION_INTERPRETACION`
   — sube cuando cambia el MÉTODO de análisis sin que cambien las capas
   (como en esta ampliación de agosto 2026), para no forzar un regasto de
   créditos de Sentinel Hub solo por mejorar el prompt. Lectura/regeneración
   admin: `GET /admin/operaciones/{id}/interpretacion-ubicacion`, botón
   "Ubicación (IA)" en AdminLeads.tsx. **Camino de refresco independiente para capas ya
   cacheadas o interpretación con método viejo** (julio 2026, bug real:
   activar la variable no le sirvió a ningún proyecto que ya tuviera sus
   6 capas generadas desde ANTES de que este módulo existiera; ampliado
   agosto 2026 para el mismo problema con `v_prompt`):
   `_interpretacion_necesita_refresco`/`_refrescar_interpretacion_en_segundo_plano`
   en `routers/proyectos.py` detectan "hay capas pero no hay
   interpretación, o quedó de una versión de capas vieja, o quedó de un
   MÉTODO de análisis viejo" como caso aparte, y generan leyendo los PNG
   de Copernicus que YA están en storage — sin volver a pedirle nada a
   Sentinel Hub (las imágenes de GEOCATMIN sí se vuelven a pedir, son
   gratis). Los dos caminos son mutuamente excluyentes por petición (si
   las capas SÍ necesitan regenerarse, ese camino ya genera la
   interpretación de una; si no, el camino independiente se encarga solo).
   **Botón "Generar ahora"** (agosto 2026, pedido explícito de Esthiven:
   antes tenía que él mismo visitar la ficha pública del proyecto para
   agendar el background task, y visitarla DE NUEVO para ver el resultado
   — la primera visita solo lo agenda, nunca lo espera):
   `POST /admin/operaciones/{id}/interpretacion-ubicacion/generar` en
   `routers/admin.py` reusa exactamente la misma lógica de
   `routers/proyectos.py` (importada como `proyectos_router`, mismo
   patrón de import cruzado entre routers que ya usa `_es_titular_concesion`
   desde `routers/mineros.py`) pero EN LÍNEA dentro de la petición, no
   como `BackgroundTask` — única excepción a la regla de "nunca llamar a
   Gemini/servicios externos dentro de una petición real": acá es una
   acción explícita del admin con un botón que puede mostrar
   "generando... (hasta 30s)" mientras espera, no una visita pública que
   no debe demorarse. 400 si no hay ni polígono de GEOCATMIN ni capas de
   Copernicus con qué trabajar; 502 si Gemini no respondió o está
   desactivado. Botón en el mismo modal "Ubicación (IA)" de AdminLeads.tsx.
   **Pasó a ser también PÚBLICA (agosto 2026, reversión explícita y
   deliberada de la regla "solo admin" de julio 2026)**: Esthiven pidió
   verla también en la ficha y en el PDF; se le preguntó explícitamente
   antes de tocar código porque invertía una decisión tomada por riesgo
   real ("puede sonar a que MineLink promete mineral") — confirmó que la
   quiere visible para inversionistas SIEMPRE con un disclaimer grande,
   nunca en letra chica. `ProyectoDetalleOut` (público, sin login) suma
   `interpretacion_ubicacion`/`interpretacion_ubicacion_generado_en` (del
   mismo caché) + `geocatmin_aster_url`/`geocatmin_anomalia_espectral_url`
   (para el PDF, ver abajo). En la ficha web,
   `InterpretacionUbicacionPublica.tsx` (nuevo componente, montado justo
   debajo de `GaleriaProyecto` — "cerca del recuadro de ubicación", pedido
   textual) muestra el texto con una caja de advertencia PROPIA (borde y
   fondo ámbar, ícono, texto en negrita) siempre ARRIBA del párrafo, nunca
   como nota al pie — el componente es la única fuente de verdad del
   disclaimer, cualquier otro lugar que muestre este texto en el futuro
   debe reusarlo o repetir exactamente esa caja, no solo el texto.
   **PDF de inversión** (`utils/pdfProyecto.ts`, mismo PDF que baja
   cualquier inversionista Y el propio minero desde su cuenta — no hay un
   PDF "solo admin"): nueva sección "Análisis satelital (IA)" después de
   "Cotejo con registros públicos", con el mismo disclaimer (caja ámbar)
   + el texto + una galería "1 por 1" de las capas (pedido textual:
   "catastro geología y fallas en una imagen, lo demás en diferentes"):
   - Catastro + geología + fallas: reusa la MISMA imagen que ya es la
     portada del PDF (`geocatmin.imagen_mapa_cotejo`, extendida agosto
     2026 con un parámetro `escala_fallas` para dibujar también las
     fallas cercanas — antes solo tenía satélite+geología+catastro).
   - ASTER 9-3-1 y Anomalías Espectrales de GEOCATMIN: nuevo endpoint
     `GET /proyectos/{id}/geocatmin-analisis/{capa}.png`, generado AL
     VUELO en cada pedido (igual que `mapa-cotejo.jpg` — llamadas
     gratis a ArcGIS, solo se piden al descargar un PDF, no en cada
     visita a la ficha). La Anomalía Espectral (antes transparente salvo
     polígonos, pensada para superponerse en el mapa interactivo) ahora
     se compone sobre una base de satélite DENTRO de
     `geocatmin.imagenes_analisis_ia` — mejora tanto lo que ve Gemini
     como lo que se imprime en el PDF, sin duplicar lógica entre los dos
     consumidores de esa función.
   - Los hasta 6 índices de Copernicus: ya tenían URLs individuales
     (`anomalias_satelitales.capas`), solo hubo que iterarlas en el PDF.
     Se muestran sobre fondo BLANCO, no negro — bug real encontrado al
     implementar esto: un canvas HTML aplana transparencia a NEGRO al
     convertir a JPEG si no se rellena antes; `fotoEnCaja()` en
     `pdfProyecto.ts` ahora rellena blanco primero (inofensivo para las
     fotos opacas normales que ya usaba esa misma función).
7. **Privacidad por diseño**: liquidaciones de venta, estados
   financieros, registro OPEX y fotos de TRABAJADORES son privados para
   siempre — públicamente solo se muestra el hecho verificado
   (`IndicadoresVerificadosOut`). El inversionista deja su interés
   (`POST /proyectos/{id}/interes`, crea su cuenta en el mismo paso) y
   Esthiven intermedia — nunca se revela el contacto del minero. El
   minero ve el CONTEO de intereses recibidos y puede "ver su proyecto
   como lo ve el inversionista".
8. **Asesor conversacional público** (`backend/asesor.py`, botón ✨ flotante
   abajo a la derecha en cualquier página, `AsesorWidget.tsx`): responde
   preguntas GENERALES de formalización minera, sin cuenta ni login.
   Deliberadamente genérico — nunca ve el diagnóstico de nadie en
   particular. Ya está en producción (código confirmado desplegado; las
   claves de API van SOLO en el panel de Environment de Render, nunca en
   el repo). Esthiven nutre al asesor soltando .md/.txt/.pdf (normas,
   jurisprudencia, guías) en subcarpetas por tema dentro de
   `context/asesor_conocimiento/` (recursivo), sin tocar código — los PDF
   se convierten primero a .md con `backend/convertir_pdfs_asesor.py`
   (reusa la extracción de PyMuPDF y borra el PDF original; en el corpus
   real bajó 92 MB a 8.4 MB y el arranque en frío de 10s a <1s — correrlo
   SIEMPRE antes de sumar PDFs nuevos). Recuperación real ("Nivel 1.5",
   julio 2026, tras crecer esa carpeta a millones de caracteres): cada
   archivo se trocea y se indexa con BM25 (`rank_bm25`, búsqueda léxica —
   sin base vectorial ni embeddings) con stopwords en español filtradas
   antes de puntuar (`asesor._STOPWORDS_ES` — sin esto, un documento que
   repite mucho "qué"/"es"/"el" puede ganarle al que sí tiene el término
   exacto). Por cada pregunta solo se mandan los 8 fragmentos más
   relevantes, más `diagnostico_formalizacion.md` + `perfil_usuario.md`
   (siempre completos, describen MineLink mismo). Generación como
   **cadena de respaldo entre proveedores** (julio 2026, pedido explícito
   de Esthiven: "cuando se acaba la gratuidad por día pasa al otro"):
   `MINELINK_ASESOR_PROVEEDORES` es una lista por prioridad (ej.
   `gemini,kimi,deepseek,qwen,glm,openai`); si el que le toca falla por lo
   que sea, pasa solo al siguiente. Hoy Gemini (`gemini-3.5-flash-lite` —
   cambiado desde `flash` a secas, que devolvía 503 "high demand" de forma
   consistente con el prompt real de ~10K tokens; verificado en vivo julio
   2026) es el único con nivel gratis real (sin tarjeta, ~1500/día); los otros 6
   proveedores están conectados y probados pero necesitan saldo cargado en
   su propio panel para responder de verdad. Modelo por proveedor:
   `MINELINK_ASESOR_MODELO_<PROVEEDOR>`. Limitado a 15 preguntas/hora por
   IP — cada pregunta real cuesta dinero de la API externa. El tokenizador
   de BM25 reduce las palabras a su raíz (`snowballstemmer`, español) para
   que "suspendieron"/"suspendido"/"suspender" cuenten como la misma
   palabra — medido con preguntas coloquiales reales (un minero no
   pregunta como está redactada la ley), esto arregló casos que antes no
   encontraban NADA; queda como brecha real solo el caso de una frase
   coloquial que no menciona el nombre del instrumento legal que busca
   (ej. "papel para no tener problemas ambientales" → IGAFOM), que sí
   necesitaría búsqueda semántica para cerrarse. El dashboard admin
   muestra qué proveedor respondió/falló por última vez y con qué error
   (tabla `LlamadaAsesor`, migración `seeds/migrar_llamadas_asesor.py`,
   confirmada corrida contra prod julio 2026 — reemplaza el conteo genérico
   por `Evento` de antes): `asesor.generar_respuesta_con_proveedor()`
   devuelve `(texto, proveedor)` si responde bien, y
   `AsesorNoDisponible.proveedor` guarda quién fue el último que falló —
   `asesor.py` sigue sin tocar la base de datos, es el router quien
   consulta/escribe. Se agregó porque un 503 real de Gemini solo se pudo
   diagnosticar probando en vivo desde la terminal; ahora
   `DashboardOut.asesor_ultimo_proveedor_ok`/`asesor_ultima_falla` lo
   dicen directo — revisar esto antes de asumir "no hay tráfico" cuando
   un proveedor falla en silencio. Los fragmentos
   recuperados se etiquetan en formato citable (`asesor._etiqueta_citable`:
   sin subcarpeta ni extensión, guiones bajos → espacios, ej. "DS
   038-2017-EM Reglamento IGAFOM") y el system prompt le pide EXPLÍCITAMENTE
   citar la norma por su nombre en la respuesta (pedido del dueño: se ve
   más profesional/confiable) — nunca inventada, solo lo que de verdad
   viene en la etiqueta de un fragmento recuperado.
9. **Segunda forma de nutrir al asesor — sin git** (pedido explícito:
   "imagina que ya no uso Claude Code"): `/admin/asesor` deja subir un
   PDF/.md/.txt directo desde el navegador. Se extrae y guarda SOLO el
   texto (no el archivo crudo) en la tabla nueva `DocumentoAsesor`
   (migración `seeds/migrar_documentos_asesor.py`, confirmada corrida
   contra producción julio 2026). `asesor.py` nunca toca la base de
   datos por sí mismo (sus tests siguen corriendo sin BD): el router
   consulta `DocumentoAsesor.activo` en cada pregunta y llama a
   `asesor.actualizar_documentos_admin(...)`, que solo reconstruye el
   índice BM25 si la lista cambió de verdad desde la última pregunta —
   agendado como tarea en segundo plano, nunca en línea (ver nota de
   rendimiento abajo). Es independiente y se combina en el mismo índice
   con la carpeta `context/asesor_conocimiento/` del repositorio.
10. **Tercera forma de nutrir al asesor — la propia cartera pública**
    (`backend/asesor_proyectos.py`, julio 2026): cada proyecto listado en
    `/proyectos` se sincroniza como un `DocumentoAsesor` (mismos datos ya
    públicos — mineral, región, Track Legal, madurez, indicadores
    verificados, capital buscado — nada privado ni personalizado a un
    caso) para que se pueda preguntar "¿qué proyectos de oro tienen en
    Puno?". Se reconcilia en segundo plano al listar `/proyectos`
    (debounce de 30 min en memoria del proceso): crea/actualiza los
    aptos, **desactiva** (nunca borra) los que dejaron de serlo.
11. **Rendimiento del índice BM25 — leer antes de tocar `asesor.py`**
    (julio 2026, causa raíz de un incidente real de 90s de cuelgue,
    encontrada perfilando en vivo): de los ~50 segundos que tarda
    reconstruir el índice sobre el corpus completo (12,000+ fragmentos),
    99% es `snowballstemmer` re-stemmeando ~1.5M de palabras — leer
    archivos y construir `BM25Okapi` no son el cuello de botella.
    `context/asesor_conocimiento/` no cambia sin un redeploy (que
    reinicia el proceso igual), así que re-tokenizarlo en CADA cambio de
    `DocumentoAsesor` (cada subida admin, cada sincronización de la
    cartera) era trabajo redundante. `_fragmentos_y_tokens_filesystem()`
    lo tokeniza UNA vez por proceso; `actualizar_documentos_admin()` solo
    re-tokeniza los documentos (chicos) que cambiaron. Consecuencia que
    debe mantenerse: `actualizar_documentos_admin()` reconstruye YA
    (dentro del mismo llamado) y por eso **nunca** debe llamarse en línea
    dentro de una pregunta real — solo desde `BackgroundTasks`
    (`routers/asesor.py` usa `documentos_admin_cambiaron()`, barato, para
    decidir si hace falta agendarla).
12. **El rate-limit por IP usa la IP real del visitante, no la del proxy**
    (julio 2026): detrás de Render + Cloudflare, `request.client.host` es
    el proxy interno de Render — la MISMA para todos los visitantes.
    Cualquier límite por IP nuevo debe pasar por `security._ip_real(request)`
    (prioriza `CF-Connecting-IP`, luego `X-Forwarded-For`, por último la
    conexión directa) — usar `request.client.host` a secas hace que el
    límite se reparta entre TODO el tráfico combinado en vez de aplicarse
    por persona.
13. **Auditoría de seguridad (julio 2026, pedido explícito de Esthiven)**
    — dos hallazgos reales, no solo teóricos: (a) el login de
    minero/inversionista tenía una fuga de tiempo (`lead is None or ...
    or not verify_password(...)` cortocircuitaba antes de llamar a
    bcrypt cuando el usuario no existía, respondiendo casi al instante
    mientras un usuario real tardaba ~200ms — dejaba adivinar qué
    usuarios existen por tiempo de respuesta). `auth.verify_password_o_dummy()`
    siempre llama a bcrypt contra un hash fijo cuando la cuenta no
    existe, medido en vivo: ~205ms vs ~205ms después del fix. (b) dos
    tablas de Supabase (`documentos_asesor`, `llamadas_asesor`) se
    crearon DESPUÉS de la migración que activó RLS en las demás tablas
    nuevas y quedaron sin ese candado — expuestas por la API pública de
    PostgREST con la anon key. **Cualquier tabla nueva necesita su
    propio `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`** (mismo patrón
    que `seeds/activar_rls_supabase.py`/`habilitar_rls_tablas_nuevas.py`/
    `habilitar_rls_asesor.py`, sin políticas — bloquea PostgREST por
    completo, el backend no se ve afectado porque se conecta como
    owner) — no alcanza con que una migración anterior ya haya cubierto
    "las tablas nuevas de ese momento".
14. **Condición de carrera real en el índice BM25 del asesor** (julio
    2026, causa de un 503 real en producción, encontrada consultando
    `LlamadaAsesor.detalle` directo): FastAPI corre los endpoints sync
    en un threadpool, así que dos preguntas simultáneas (o una pregunta
    + el `BackgroundTask` de `actualizar_documentos_admin` reconstruyendo
    el índice) podían entrar a la vez a
    `_fragmentos_y_tokens_filesystem()`. Sin lock, un hilo podía alcanzar
    a asignar `_FRAGMENTOS_FS_CACHE` pero no `_TOKENS_FS_CACHE` todavía
    (dos líneas separadas, no es atómico) justo cuando otro hilo pasaba
    el `if ... is None` y leía el segundo en `None` — eso llegaba hasta
    `tokens_fs + tokens_admin` en `_indice_fragmentos()` y reventaba con
    `unsupported operand type(s) for +: 'NoneType' and 'list'`. Ambas
    funciones están protegidas con `threading.Lock` (patrón doble
    chequeo: se revisa de nuevo DENTRO del lock por si otro hilo ya
    terminó mientras se esperaba turno, para no perder la optimización
    de construir el índice una sola vez por proceso).

Esthiven es el único administrador: carga empresas (una por una, o en
lote por CSV — el importador acepta tanto el formato propio como el
archivo crudo del scraper de Google Places, y todo lo importado en lote
nace INACTIVO y sin exigir RUC/colegiatura hasta que él lo revise y
active), revisa leads con su perfil/semáforos/alertas del Módulo INV
(AL1-AL10), APRUEBA/RECHAZA cada documento subido (julio 2026: ese
estado_revision es lo único que otorga el sello público "Con respaldo" —
subir el archivo resuelve la brecha pero no da el sello), verifica a
mano códigos REINFO (el cotejo automático está desactivado), resetea
contraseñas y puede marcar brechas puntuales como resueltas por
seguimiento manual. Las empresas NO tienen acceso; su rating solo se ve
en el admin (ordena internamente /empresas sin mostrarse).

## Rol de este archivo
Este es el archivo del ORQUESTADOR. Cuando recibas una instrucción:
1. Lee SIEMPRE primero `errores_aprendidos.md` antes de tocar código
2. Identifica qué agente corresponde según la tabla de abajo
3. Lee el archivo del agente en `agents/` y sigue sus reglas
4. Carga la skill correspondiente de `skills/` solo si la tarea la necesita
5. Los archivos de `context/` son la fuente de verdad del negocio:
   NUNCA contradigas `diagnostico_formalizacion.md`, `criterios_score.md`
   (reglas transversales) ni `perfil_usuario.md`

## Tabla de enrutamiento (qué agente activar)

| Si la tarea involucra... | Agente | Skill asociada |
|---|---|---|
| Endpoints, modelos BD, semáforos/scores, catálogos, FastAPI, pytest | agents/backend.md | skills/diagnostico-brechas |
| Páginas, componentes React, cuestionario UI, Tailwind, resultados | agents/frontend.md | skills/score-display, skills/empresa-card |
| Panel de administración, CRUD empresas, tabla de leads, JWT | agents/admin.md | skills/admin-panel |
| Tareas mixtas (ej. "conecta el frontend al backend") | backend primero, luego frontend | las de ambos |

## Stack tecnológico
- Backend: Python 3.10+ · FastAPI · SQLAlchemy · **Postgres vía Supabase** (ver abajo)
- Frontend: React 18 · TypeScript strict · Tailwind CSS · Vite
- Tests: pytest (backend) · sin tests frontend en MVP
- Idioma: código en inglés, comentarios y respuestas en español

## Producción (IMPORTANTE: el proyecto YA está desplegado)

- **Web pública**: https://mine-link-seven.vercel.app (Vercel, carpeta `frontend/`)
- **API pública**: https://minelink-api.onrender.com (Render, carpeta `backend/`, plan gratuito)
- **Auto-deploy**: cada push a `main` en GitHub (repo `esthivencruz46-rgb/MineLINK`) redespliega
  ambos automáticamente. El push lo hace Esthiven desde GitHub Desktop (la terminal del agente
  no tiene sus credenciales) — tras un commit, pedirle "dale Push origin en GitHub Desktop".
- **Variables de entorno de producción**: viven en los paneles de Render y Vercel (no en el repo).
  Render necesita: DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, SECRET_KEY, FRONTEND_URL,
  PYTHON_VERSION=3.12.8 (¡crítico: sin ella el build falla con Python nuevo!), SUPABASE_URL,
  SUPABASE_SERVICE_KEY. Para las anomalías satelitales (julio 2026, opcional — sin esto la
  feature queda simplemente apagada, no rompe nada): MINELINK_COPERNICUS=1,
  CDSE_CLIENT_ID, CDSE_CLIENT_SECRET (Dashboard de dataspace.copernicus.eu → User Settings →
  OAuth Clients — cuenta gratis, nivel "General user" con 10,000 Processing Units/mes,
  ~20-25 PU por concesión completa, alcanza para cientos de concesiones al mes). Para que la
  IA interprete esas capas (julio 2026, opcional, solo admin — ver interpretacion_ubicacion.py):
  MINELINK_INTERPRETACION_UBICACION=1 (además de MINELINK_COPERNICUS=1 y GEMINI_API_KEY, que
  ya debería estar puesta para el asesor). Vercel: VITE_API_URL_WEB y VITE_API_URL_NATIVE.
- **UptimeRobot** visita /health cada 5 min: mantiene despierto el plan gratuito de Render y
  alerta por correo si algo cae.
- El APK de Android apunta al backend público. Tras cambios de frontend, el ciclo completo es:
  `npm run android:sync` → `gradlew assembleDebug` → copiar a `Descargas\MineLink.apk` →
  `python -m seeds.publicar_apk` (lo sube al bucket PÚBLICO `descargas` de Supabase, de donde
  descarga el botón "Descargar la app" de la portada — URL fija). NO regenerar el APK tras cada
  cambio — solo cuando Esthiven lo pida explícitamente.
- CORS: orígenes locales + regex `https://mine-link-[a-z0-9-]+\.vercel\.app` + FRONTEND_URL
  (ver `main.py`). Si la web pública no carga datos, revisar esto primero.

## Comandos comunes

### Backend (desde `backend/`)
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000   # servidor dev
pytest -q                                                 # toda la suite (~330 tests)
pytest tests/test_scoring.py -q                           # un archivo
pytest tests/test_smoke.py::test_post_diagnostico -q      # un test puntual
pip install -r requirements.txt                           # dependencias (usar --break-system-packages en este entorno)
```
Los tests (`tests/test_smoke.py`, `tests/test_scoring.py`) usan un engine SQLite en memoria propio
vía `app.dependency_overrides[get_db]` — nunca tocan la base real (SQLite local ni Supabase),
así que corren igual sin importar qué diga `DATABASE_URL`. Además desactivan toda llamada
externa: `MINELINK_RESOLVER_MAPS=0` (Google Maps) y `MINELINK_GEOCATMIN=0` (INGEMMET).

### Frontend (desde `frontend/`)
```bash
npm run dev       # servidor dev en 127.0.0.1:5173 (usar 127.0.0.1, no localhost — ver errores_aprendidos.md)
npm run build     # tsc -b && vite build — usar esto para chequear tipos, no hay comando "typecheck" separado
npm run preview   # sirve el build de producción
```
No hay linter ni test runner de frontend configurado en este proyecto.

Rutas principales (públicas, inversionista, admin) están listadas en `RUTAS.md`.

### App Android (Capacitor, desde `frontend/`)
```bash
npm run android:sync    # npm run build + npx cap sync android
npm run android:open    # abre el proyecto nativo en Android Studio
```
Capacitor 6.x fijado (NO 8.x — requiere Node ≥22, este entorno tiene Node 18). El proyecto nativo
generado vive en `frontend/android/` (no editar a mano salvo `AndroidManifest.xml`). Para compilar
por línea de comandos (`gradlew assembleDebug`) hace falta `JAVA_HOME` apuntando al JBR de la
versión de Android Studio instalada (ver `errores_aprendidos.md`). Tres ajustes son obligatorios
para que la app hable con un backend HTTP local en desarrollo (quitar cuando haya HTTPS real):
- `capacitor.config.ts`: `server: { androidScheme: "http" }` (si no, Mixed Content bloquea las
  llamadas desde `https://localhost` a un backend HTTP plano).
- Backend corriendo con `--host 0.0.0.0` (no solo `127.0.0.1`) para que el emulador lo alcance
  vía `10.0.2.2`.
- `AndroidManifest.xml`: `android:usesCleartextTraffic="true"` (Android 9+ bloquea HTTP plano por
  defecto y esto falla en silencio, sin log visible).

**Sesión persistida + bloqueo biométrico** (agosto 2026, pedido explícito de Esthiven: "como en
eToro" en web, con huella en la app): el JWT de minero/inversionista ya duraba 30 días en el
backend (`auth.MINERO_TOKEN_EXPIRE_MINUTES`) — el frontend lo guardaba SOLO en memoria y lo
perdía en cada recarga; ahora `MineroAuthContext`/`InversionistaAuthContext` lo persisten en
`localStorage` (mismo patrón que `useTheme.ts`). El admin (`AuthContext.tsx`) se queda en memoria
a propósito. Encima de eso, `components/BloqueoBiometrico.tsx` (paquete
`@aparajita/capacitor-biometric-auth@^8.0.2` — la versión más nueva compatible con Capacitor 6.x
fijado en este proyecto; `10.x` ya pide Capacitor 8) pide huella/Face ID al abrir o retomar la
app **nativa** (`Capacitor.isNativePlatform()`), solo si hay una sesión abierta y el teléfono
tiene biometría configurada (si no, no bloquea nada — mismo comportamiento que la web). Requiere
`android.permission.USE_BIOMETRIC` en `AndroidManifest.xml` y sincronizar
(`npm run android:sync`) para que el módulo nativo se registre en `capacitor.settings.gradle`.

## Base de datos: SQLite local + Supabase

El backend soporta ambos motores sin cambiar código (`database.py`):
- **Sin `DATABASE_URL` configurada** → usa `sqlite:///./minelink.db` automáticamente (modo dev
  original, cero fricción). Activa `PRAGMA journal_mode=WAL` y `busy_timeout=5000` en cada conexión.
- **Con `DATABASE_URL` en `backend/.env`** (cadena de Postgres de Supabase, formato
  `postgresql://...`) → usa esa. `backend/.env` NUNCA se comparte ni se sube a ningún repo
  (ver `.env.example` para la plantilla). Producción/el proyecto real ya está migrado a Supabase.
  **⚠️ `backend/.env` apunta a producción: cualquier seed corrido localmente ejecuta contra la
  base real — nunca correr uno sin confirmación explícita de Esthiven.**
- RLS (Row Level Security) está activado en las tablas de Supabase, sin políticas — bloquea el
  acceso vía la API pública de PostgREST (anon key), pero no afecta al backend porque se conecta
  como el owner (`postgres`) de las tablas.
- `backend/seeds/*.py` son scripts de migración/utilidad de un solo uso (correr con
  `python -m seeds.<nombre>` desde `backend/`). Antes de escribir una migración nueva, copiar el
  patrón de `seeds/migrar_ubicacion_maps.py` (usa el engine de `database.py`, respeta
  `DATABASE_URL`, funciona en ambos motores). Los seeds antiguos con `sqlite3` directo solo
  tocan la SQLite local.
- `backend/seeds/backup_db.py` respalda `minelink.db` + `uploads/` a `backend/backups/` (conserva
  los últimos 14). Uso seguro con el servidor corriendo (usa el backup API de sqlite3).

## Archivos subidos (fotos, PDFs)

Modo dual vía `backend/storage.py` (la BD solo guarda el nombre de archivo, no el contenido):
- **Con `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` en el entorno** → Supabase Storage, bucket privado
  `archivos-minelink` (carpetas `documentos_mineros/` y `cvs/`). Es el modo de producción (Render
  tiene disco efímero: lo escrito ahí se borra en cada deploy). Los archivos se sirven SIEMPRE a
  través del backend, nunca por URL directa del bucket.
- **Sin esas variables** → disco local `backend/uploads/` (dev y tests, como siempre).
- `seeds/migrar_archivos_a_storage.py` COPIA lo local al bucket (verificación byte a byte, no
  borra nada). Los archivos locales quedan como respaldo permanente.
- **Nunca borrar archivos de `backend/uploads/` con comandos amplios tipo `rm -f uploads/*/*`**
  — ver `errores_aprendidos.md`, ya causó pérdida de datos reales dos veces.

## Estructura del proyecto
```
/
├── CLAUDE.md                  ← este archivo (orquestador)
├── errores_aprendidos.md      ← LEER SIEMPRE antes de tocar código
├── RUTAS.md                   ← rutas principales del frontend (público/inversionista/admin)
├── DESPLIEGUE.md              ← checklist de despliegue (ya ejecutado; sirve para replicar/migrar)
├── LIMPIEZA.md                ← cómo borrar datos de simulación de forma segura
├── INTERMEDIACION.md          ← filosofía de negocio del match minero-inversionista
├── context/
│   ├── diagnostico_formalizacion.md ← SPEC ACTUAL: perfiles A/B/C/D, semáforos, madurez
│   ├── criterios_score.md     ← reglas transversales (evidencia, equivalencias, catálogo,
│   │                             scores) + resumen del modelo viejo en pausa
│   ├── perfil_usuario.md      ← quién es el minero, tono de UI
│   └── asesor_conocimiento/   ← soltar .md/.txt/.pdf (cualquier subcarpeta) nutre al
│                                 asesor público — se lee recursivo, ver asesor.py
├── agents/
│   ├── backend.md
│   ├── frontend.md
│   └── admin.md
├── skills/
│   ├── diagnostico-brechas/SKILL.md
│   ├── score-display/SKILL.md
│   ├── empresa-card/SKILL.md
│   └── admin-panel/SKILL.md
├── backend/
│   ├── main.py                 ← registra los routers, crea tablas al arrancar
│   ├── database.py             ← engine SQLite/Postgres, WAL, get_db()
│   ├── models.py               ← SQLAlchemy: Operacion, Lead, Empresa, DocumentoOperacion,
│   │                              InteresInversion, InteresEmpresa, Notificacion, Evento,
│   │                              DocumentoAsesor, LlamadaAsesor
│   ├── schemas.py              ← Pydantic (request/response)
│   ├── catalogo_diagnostico.py ← catálogo del diagnóstico: ids, tipos, condicionales,
│   │                              brecha→estudio (BRECHA_POR_PREGUNTA)
│   ├── catalogo_inversion.py   ← Módulo INV: activación, ids por perfil, respaldos
│   │                              declarados, brechas INV, alertas AL1-AL10
│   ├── scoring.py              ← perfiles/semáforos/madurez/scores + estado_seguimiento
│   │                              (lógica pura, `hoy` inyectable)
│   ├── scoring_legacy.py       ← ⏸️ MineScore viejo (EN PAUSA, no importar)
│   ├── auth.py                 ← JWT admin/minero/inversionista, hashing de passwords
│   ├── security.py             ← rate-limit de logins y validación de magic bytes;
│   │                              _ip_real() para IP real detrás de Render+Cloudflare
│   ├── storage.py              ← archivos en Supabase Storage (prod) o disco local (dev/tests)
│   ├── imagenes.py             ← compresión de fotos y conversión PDF → foto (PyMuPDF)
│   ├── geoubicacion.py         ← enlace de Google Maps → coordenadas (best-effort, con
│   │                              auto-reparación al leer: reparar_ubicacion_coords)
│   ├── geocatmin.py            ← INGEMMET por punto: catastro minero + geología (best-effort,
│   │                              caché 30 días en datos_formalizacion_json["_geocatmin"])
│   ├── copernicus.py           ← anomalías espectrales minerales (Sentinel-2 vía Copernicus
│   │                              Data Space Ecosystem) sobre el polígono real de la concesión —
│   │                              DESACTIVADO por defecto (MINELINK_COPERNICUS=1 + credenciales)
│   ├── interpretacion_ubicacion.py ← cruza litología/fallas de GEOCATMIN (texto) + ASTER
│   │                              9-3-1/Anomalías Espectrales de GEOCATMIN + las 6 capas
│   │                              de Copernicus (imágenes, Gemini Vision) en una
│   │                              interpretación en texto — SOLO admin, nunca público
│   │                              (MINELINK_INTERPRETACION_UBICACION=1)
│   ├── uploads_config.py       ← categorías de archivos + equivalencias + fotos de perfil
│   ├── notificaciones.py       ← crear_notificacion (campanita del minero)
│   ├── asesor.py                ← asesor público: retrieval (context/) + generación
│   │                              intercambiable por proveedor (claude/gemini/grok/simulado)
│   ├── asesor_proyectos.py     ← sincroniza la cartera pública de /proyectos como
│   │                              DocumentoAsesor (tercera vía de nutrición, ver arriba)
│   ├── routers/
│   │   ├── diagnostico.py      ← POST /diagnostico
│   │   ├── asesor.py            ← POST /asesor (público, sin auth, rate-limit por IP)
│   │   ├── eventos.py          ← POST /eventos (métricas de embudo, anónimas)
│   │   ├── empresas.py         ← GET /empresas, POST /consultores/postular, /interes
│   │   ├── leads.py            ← POST /leads (registro del minero + su cuenta)
│   │   ├── mineros.py          ← login, /me, perfil-inversion, documentos, /inversion,
│   │   │                          notificaciones
│   │   ├── inversionistas.py   ← /inversionistas/login, /me
│   │   ├── proyectos.py        ← cartera pública, ficha, indicadores, GEOCATMIN, /interes
│   │   └── admin.py            ← todo lo protegido por JWT admin
│   ├── seeds/                  ← migraciones/utilidades de un solo uso (⚠️ corren contra prod)
│   ├── uploads/                ← archivos subidos — NUNCA `rm -f *`
│   └── tests/                  ← test_smoke.py (end-to-end) + test_scoring.py (lógica pura)
└── frontend/
    ├── capacitor.config.ts     ← config de la app Android
    ├── android/                ← proyecto nativo generado (no editar salvo AndroidManifest.xml)
    └── src/
        ├── data/               ← espejos TS de los catálogos backend (preguntas.ts,
        │                          preguntasInversion.ts, brechas.ts, estudiosPorDimension.ts)
        │                          — ⚠️ los sets de ids DEBEN coincidir con el backend o el
        │                          POST devuelve 422; preguntasPerfil.ts/perfilInformativo.ts
        │                          están EN PAUSA (no borrar)
        ├── components/         ← incluye proyecto/ para la ficha pública
        ├── config/marca.ts     ← ÚNICA fuente del nombre de marca ("MineLink") — todo
        │                          texto visible la importa; nunca escribir la marca a mano
        ├── pages/              ← incluye admin/ para el panel
        ├── context/            ← AuthContext (admin), MineroAuthContext, InversionistaAuthContext
        ├── types/
        └── services/api.ts     ← todas las llamadas fetch al backend
```

### Línea visual (julio 2026, aprobada por Esthiven — "más profesionalismo")
Estética institucional en TODA la web y el admin: bordes finos
(`border border-black/10 dark:border-white/10`) en vez de tarjetas con
sombra y `rounded-*`; chips planos con borde en vez de burbujas de color;
`font-semibold` en vez de `font-bold`; el color de acento reservado para
la acción principal. El verde/ámbar/rojo semántico se mantiene SOLO donde
comunica estado real (semáforos, verificaciones, alertas). Cualquier UI
nueva debe seguir esta línea.

Componente compartido `HeroFranja.tsx` (franja de encabezado con
degradado verde institucional + patrón de líneas topográficas en SVG +
entrada animada `motion-safe:animate-[hero-entrada_...]`, definida en
`index.css`) — reemplaza el `<h1>+<p>` plano que encabezaba Proyectos,
Postular, ComoFunciona y la primera pregunta del diagnóstico. Inicio
tiene su propio hero más grande y centrado (no usa este componente).

**Auditoría de consistencia (julio 2026, pedido explícito: "analiza qué
áreas te falta mejorar de la página web total")** — hallazgo real, no
solo cosmético: `PublicHeader` (`App.tsx`) no tenía NINGÚN link de
navegación en toda la web pública, solo el logo y el botón de tema
— corregido con los mismos 3 links que ya tenía el `Footer` más un
menú "Ingresar" (`<details>` nativo, mismo patrón que el filtro de
Empresas.tsx) que despliega "Soy minero" / "Soy inversionista" — un
solo link fijo mandaba a los inversionistas al login equivocado
(reportado en vivo con captura). Aparte, `MiCuenta.tsx`/`MiConcesion.tsx`
y los formularios de login/registro/recuperar-contraseña nunca se
habían migrado a esta línea (cajas `rounded-lg` de fondo sólido sin
borde, píldoras `rounded-full` en negrita, inputs sin foco visible) —
ya migrados; los dos wizards (`Cuestionario.tsx`/`CuestionarioInversion.tsx`)
siguen deliberadamente con su propio estilo `rounded-lg` interno (no se
tocó: cambiarlo implica demasiados elementos interactivos para verificar
sin un navegador real).

## Reglas de autonomía

### Preguntas y confirmaciones (agosto 2026, pedido explícito de Esthiven)
No te detengas a preguntar "¿sí o no?" / "¿confirmás?" para decisiones
que ya tienen una opción sensata o recomendada — elegí esa opción y
avanzá, en vez de esperar respuesta. Esthiven no quiere frenar seguido
para dar permiso en cosas chicas; prefiere corregir después si algo no
le sirvió. Reservá una pregunta explícita (AskUserQuestion) solo para lo
que de verdad no podés resolver solo: elegir entre direcciones sin
ninguna pista de cuál prefiere, o algo caro/difícil de deshacer si se
adivina mal — para eso sigue en pie, sin excepción, la lista de "SIEMPRE
confirma antes de" más abajo (borrar, migrar contra producción, cambiar
config sustancial, conectar un servicio nuevo). Si igual hace falta
preguntar algo con varias opciones y una está marcada "(recomendada)",
priorizá seguir con esa en cuanto sea razonable — no hay forma técnica
de detectar "pasó 1 minuto sin respuesta" dentro de una conversación (no
es un proceso en vivo con temporizador), así que el equivalente práctico
del pedido de Esthiven es: no pausar de entrada si ya hay un default
razonable, en vez de preguntar y quedarse esperando.

### Puedes hacer SIN confirmar
- Crear/editar archivos de código
- Instalar dependencias (pip install --break-system-packages / npm install)
- Ejecutar uvicorn, npm run dev, pytest, npm run build
- Corregir errores de TypeScript, Python o ESLint

### SIEMPRE confirma antes de
- Borrar archivos o carpetas
- Modificar el esquema de BD si ya tiene datos, y CORRER cualquier seed/migración
  (ejecutan contra producción vía `backend/.env`)
- Cambiar tsconfig.json, vite.config.ts o pyproject de forma sustancial
- Conectar un servicio externo NUEVO (Supabase y GEOCATMIN ya están conectados,
  eso no cuenta como "nuevo" — pero desplegar a un hosting, cambiar de proyecto de
  Supabase, o conectar otro servicio sí requiere confirmar)
- Correr cualquier `rm`/borrado sobre `backend/uploads/` más allá de un archivo puntual
  que el propio agente subió en la misma sesión (ver errores_aprendidos.md)

### Flujo ante un error
1. Intenta resolverlo hasta 2 veces
2. Si persiste → registra en errores_aprendidos.md (formato definido ahí)
3. Avisa: qué falló, qué intentaste, qué necesitas

## Reglas duras del negocio (NUNCA violar)
- **Regla de bloqueo**: un proyecto con semáforo legal ROJO nunca se muestra a
  inversionistas; perfiles A/A_avanzado y filas del modelo viejo nunca listan en
  `/proyectos`; publicar exige haber ENVIADO documentos de formalización + Módulo INV.
  No hay visto bueno manual del admin — la publicación es automática al cumplir eso
- **Privacidad de archivos**: liquidaciones de venta, estados financieros, registro
  OPEX y fotos de TRABAJADORES son PRIVADOS para siempre (públicamente solo el hecho
  verificado — `IndicadoresVerificadosOut`). Las fotos de documentos legales/estudios y
  la galería sí son públicas (decisión explícita del cliente). Solo se aceptan/guardan
  como foto (PDF se convierte al subir), nunca como PDF crudo
- El ✓ público de un requisito exige foto de respaldo subida — nunca solo la
  declaración
- El minero NUNCA ve datos de otros mineros
- Los datos de contacto del minero (leads) solo son visibles en el panel admin —
  ni empresas ni inversionistas los reciben directo; Esthiven intermedia siempre
- No inventes empresas: solo se muestran las que Esthiven cargó
- Todos los textos visibles al minero en lenguaje simple (ver perfil_usuario.md)
- Un mismo WhatsApp o código REINFO no puede registrar dos leads (409 si se repite)
- Un CIP (colegiatura) de consultor es único: no se puede postular dos veces con el mismo
- Los datos de GEOCATMIN son siempre REFERENCIALES (el pin es aproximado; operar la
  concesión de otro titular por contrato es legal) — nunca presentarlos como acusación
- Las preguntas viejas EN PAUSA no se borran (decisión del dueño)
- El asesor conversacional NUNCA se personaliza al caso de un usuario (decisión
  explícita del dueño: "genérico, sin caso personal") y siempre queda detrás de un
  rate-limit — cada pregunta real cuesta dinero de una API externa de pago
