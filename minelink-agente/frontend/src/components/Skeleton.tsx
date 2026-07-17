/** Bloque gris pulsante — pieza base para armar esqueletos de carga
 *  (julio 2026: reemplaza los "Cargando..." de texto plano en las
 *  pantallas de más tráfico). Mismo radio/tono en ambos temas para que
 *  no "salte" al terminar de cargar y renderizar el contenido real. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`}
      aria-hidden
    />
  );
}

/** Imita una ProyectoCard de /proyectos: foto + 3 líneas de texto. */
export function TarjetaProyectoSkeleton() {
  return (
    <div className="flex gap-4 rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <Skeleton className="h-24 w-24 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-1 h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** Imita una EmpresaCard de /empresas: badges + título + chips. */
export function TarjetaEmpresaSkeleton() {
  return (
    <div className="rounded-xl bg-tarjeta p-4 dark:bg-tarjeta-dark">
      <Skeleton className="h-4 w-24 rounded-full" />
      <Skeleton className="mt-2 h-5 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-11 w-full" />
    </div>
  );
}

/** Panel de cuenta (MiCuenta/MiConcesion): encabezado + tarjetas de
 *  semáforo + lista. */
export function PanelCuentaSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  );
}

/** Ficha pública de un proyecto (/proyectos/:id): mosaico de fotos +
 *  título + tarjetas de sección — mismo alto aproximado que el contenido
 *  real para que la página no "salte" al terminar de cargar. */
export function FichaProyectoSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-64 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
