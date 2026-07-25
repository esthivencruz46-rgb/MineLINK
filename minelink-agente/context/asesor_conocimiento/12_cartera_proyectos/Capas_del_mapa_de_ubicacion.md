# Mapa de ubicación en la ficha de un proyecto — qué es cada capa y qué significa cada color

## Qué es este mapa

Cada proyecto publicado en la cartera pública de MineLink (/proyectos) tiene
una ficha con un mapa satelital de su ubicación. Sobre la imagen satelital se
pueden activar distintas "capas" — información oficial de INGEMMET/GEOCATMIN
y análisis satelital propio (Copernicus/Sentinel-2) — para entender mejor el
contexto legal y el potencial geológico del terreno. Todas son señales
referenciales que complementan el diagnóstico legal del proyecto — ninguna
reemplaza una visita de campo ni un estudio geológico formal.

## Capa "Catastro minero"

Encendida por defecto. Muestra los límites oficiales de las concesiones
mineras registradas en INGEMMET, incluida la propia del proyecto (resaltada
con un borde verde) y las concesiones vecinas.

## Capa "Geología"

Mapa geológico oficial de INGEMMET, a dos escalas: 1:100,000 (cobertura de
todo el país) y 1:50,000 (más detallada, solo donde INGEMMET la tiene
disponible — se dibuja encima de la 100K donde existe). Los colores
corresponden a distintas unidades geológicas/litológicas según la
clasificación propia de INGEMMET (no un código de colores definido por
MineLink) — un clic sobre el mapa muestra el nombre de la unidad. Se ve tenue
en reposo y se ve completa al pasar el mouse por encima.

## Capa "Fallas geológicas cercanas"

Si el sistema encuentra fallas geológicas registradas cerca del punto del
proyecto, las traza sobre el mapa. Es información de riesgo
geotécnico/sísmico referencial, no una alerta de peligro inminente.

## Grupo "Sensores satelitales · INGEMMET" (apagadas por defecto)

- **ASTER 9-3-1**: combinación de bandas satelitales en falso color, NO es un
  índice mineral exacto — el verde tiende a ser vegetación, y los tonos
  rojo/rosado/naranja tienden a ser roca expuesta (más intensos donde hay más
  alteración arcillosa). Se interpreta de forma cualitativa, como lo haría un
  geólogo revisando el patrón visual, no como una tabla de colores exacta.
- **Índices minerales QICIMI**: a diferencia de ASTER, este SÍ es un índice
  mineral real — un color = un mineral (confirmado contra la metadata oficial
  de INGEMMET/GEOIDEP): rojo = cuarzo/sílice, verde = carbonatos, azul =
  minerales máficos.
- **Anomalías espectrales** (servicio propio de INGEMMET): polígonos donde el
  análisis satelital de INGEMMET detecta anomalías — rojo = óxidos, verde =
  arcillas, amarillo = óxidos y arcillas juntos. Un clic sobre un polígono
  indica cuál es.
- **Libre denuncio / aviso de retiro**: muestra concesiones YA EXTINGUIDAS que
  están en proceso de liberarse para que alguien más pueda presentar un
  petitorio nuevo sobre esa área — ámbar = "Libre Denunciabilidad" (ya se
  puede pedir), morado = "Aviso de Retiro" (todavía dentro del plazo de aviso
  de la Ley 30428, todavía no se puede pedir). Útil sobre todo para quien
  busca terreno disponible para un petitorio nuevo (perfil "desde cero" en
  MineLink). Importante: que esta capa muestre un área superpuesta cerca de
  una concesión VIGENTE no significa un conflicto — son concesiones antiguas
  ya extinguidas, es normal que el terreno liberado termine dentro o cerca de
  una concesión actual.

## Grupo "Sentinel-2 · Copernicus" (apagadas por defecto)

Análisis propio de MineLink sobre imágenes satelitales Sentinel-2, calculado
específicamente sobre el polígono REAL de la concesión del proyecto (no un
cuadrado genérico alrededor del punto). Son 4 índices de exploración minera;
cada uno pinta SOLO el 10% más alto de ese índice dentro de la concesión (el
resto queda transparente) — es decir, resalta las zonas relativamente más
altas dentro de ESE proyecto específico, no un valor absoluto fijo igual para
cualquier zona del país:

- **Óxidos de hierro** (rojo)
- **Arcillas** (azul)
- **Hierro ferroso** (naranja)
- **Arcilla / sulfatos / mica** (amarillo)
- **Anomalías combinadas (todas)**: superpone los 4 índices anteriores en un
  solo mapa
- **Coincidencia de 2+ anomalías** (violeta, más opaco mientras más índices
  coinciden en el mismo punto): resalta los puntos donde 2 o más de los 4
  índices minerales coinciden a la vez — una señal más confiable que
  cualquier índice aislado, porque que varios índices independientes señalen
  exactamente el mismo punto es menos probable que sea casualidad.

Límite honesto de esta tecnología (importante aclararlo si preguntan qué tan
preciso es): Sentinel-2 solo tiene 2 bandas anchas en el infrarrojo de onda
corta (SWIR), así que estos índices NO son una clasificación fina de
alteración hidrotermal (propilítica/argílica/filítica/sericítica) — esa
precisión necesitaría un sensor como ASTER, con 6 bandas SWIR angostas. Son
una señal exploratoria referencial ("acá hay relativamente más de este
mineral que en el resto de la concesión"), no un diagnóstico geológico
certero — sirve para orientar dónde vale la pena mirar más de cerca, no
reemplaza el trabajo de un geólogo ni una campaña de muestreo real.

## Cómo responder preguntas sobre este mapa

- Si preguntan "¿qué significa el color X?", identificar primero DE QUÉ CAPA
  están hablando — los mismos colores (rojo, verde, amarillo) significan
  cosas distintas en QICIMI, en Anomalías espectrales de INGEMMET, y en los
  índices de Copernicus/Sentinel-2. No asumir cuál sin que quede claro.
- Nunca dar a entender que una anomalía satelital confirma la presencia de
  mineral — siempre aclarar que es una señal referencial que amerita
  verificación en campo.
- La capa "Libre denuncio / aviso de retiro" NO es una alerta de conflicto
  legal sobre la concesión del proyecto que se está mirando — es información
  de oportunidad para quien busca terreno nuevo, no un problema del proyecto
  actual.
