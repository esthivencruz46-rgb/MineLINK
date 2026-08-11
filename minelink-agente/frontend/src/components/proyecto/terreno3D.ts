// Tiles de relieve "terrarium" del dataset abierto de AWS (sin API key),
// usados por la vista 3D (Mapa3D.tsx). El template vive acá para que la
// pre-carga en segundo plano (MapaGeocatmin.tsx) y MapLibre compartan un
// único lugar de la verdad.

export const TERRENO_TILES =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";

// El dataset llega hasta zoom 15; el 3D se mueve entre 12 y 15 según el
// tamaño de la concesión (fitBounds), así que se calientan esos 4 niveles.
const ZOOMS_RELIEVE = [12, 13, 14, 15];
// Vecindad 3x3 alrededor del centro por zoom — cubre la concesión y algo
// de contexto. 4 zooms × 9 tiles = 36 fetch (~1.5 MB, en segundo plano y
// cacheados por el navegador de ahí en más).
const RADIO_TILES = 1;

function tileXY(lng: number, lat: number, zoom: number): [number, number] {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return [x, y];
}

/** Descarga en segundo plano (fetch + caché HTTP del navegador) los tiles
 * de relieve alrededor de un proyecto. Al pulsar "Vista 3D", MapLibre los
 * encuentra ya cacheados y el relieve aparece sin esperar la red. No se
 * crea ningún mapa acá: solo se calienta la caché. Best-effort: si un
 * tile falla, se ignora. */
export function precargarRelieve(lat: number, lng: number): void {
  for (const zoom of ZOOMS_RELIEVE) {
    const [x0, y0] = tileXY(lng, lat, zoom);
    const n = 2 ** zoom;
    for (let dx = -RADIO_TILES; dx <= RADIO_TILES; dx++) {
      for (let dy = -RADIO_TILES; dy <= RADIO_TILES; dy++) {
        const x = (((x0 + dx) % n) + n) % n;
        const y = Math.min(Math.max(y0 + dy, 0), n - 1);
        const url = TERRENO_TILES.replace("{z}", String(zoom))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        // CORS obligatorio (no `no-cors`): solo las respuestas CORS
        // pueden reutilizarse desde el fetch de MapLibre.
        fetch(url, { mode: "cors" }).catch(() => {});
      }
    }
  }
}
