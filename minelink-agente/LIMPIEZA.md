# Cómo limpiar datos de simulación — Qorilink

Guía para borrar los datos de prueba (mineros, diagnósticos, fotos,
inversionistas simulados) y dejar la plataforma lista para usuarios reales.

## Regla de oro: primero respalda

Antes de cualquier borrado, corre desde `backend/`:

```bash
python -m seeds.backup_db
```

Eso guarda una copia de la base local y de los archivos en `backend/backups/`.
(La base real está en Supabase; este respaldo es una red de seguridad extra.)

## Opción A — Borrar de a pocos (recomendada si quieres conservar algo)

Desde el **panel admin** (`/admin`), sin tocar código:

| Qué quieres borrar | Dónde |
|---|---|
| Un minero de prueba (con su diagnóstico, fotos, documentos e inversionistas interesados) | `/admin/leads` → botón **Eliminar** en su fila. Borra TODO lo asociado de una vez. |
| Una empresa o consultor de prueba | `/admin/empresas` → **Eliminar** (definitivo) o desactivar (reversible). |
| Una foto/documento puntual de un minero | El propio minero desde su cuenta (`/mi-cuenta` → Documentos → Eliminar). |

Esto funciona igual en local y en producción (el panel borra en Supabase,
que es la misma base para web y app).

## Opción B — Borrar TODO de golpe (borrón y cuenta nueva)

Desde `backend/` (con el `.env` apuntando a la base que quieres limpiar):

```bash
python -m seeds.limpiar_datos_prueba
```

- Muestra un resumen de cuántas filas va a borrar y **pide confirmación
  escribiendo `SI BORRAR TODO`** — si escribes otra cosa, no borra nada.
- Borra: mineros (leads), diagnósticos, documentos/fotos (también sus
  archivos en Supabase Storage, uno por uno), intereses de inversionistas
  y eventos de métricas.
- **NO borra** las empresas/consultores (para eso agrega
  `--incluir-empresas`) y **NUNCA toca** los archivos locales de
  `backend/uploads/` (quedan como respaldo en esta PC).

## Lo que NUNCA se debe hacer

- `rm -f uploads/*` o cualquier borrado con comodines sobre
  `backend/uploads/` — ya causó pérdida de archivos reales dos veces
  (ver `errores_aprendidos.md`).
- Borrar filas directamente desde el editor SQL de Supabase sin borrar
  los archivos asociados: quedarían archivos huérfanos ocupando espacio.
- Borrar sin respaldo previo.

## Nota sobre "empezar de cero" en producción

Si limpias todo para lanzar con usuarios reales, recuerda que las cuentas
de prueba del celular/emulador también desaparecen (los usuarios y
contraseñas de mineros simulados dejan de existir). El APK y la web no
necesitan cambios: simplemente mostrarán la plataforma vacía.
