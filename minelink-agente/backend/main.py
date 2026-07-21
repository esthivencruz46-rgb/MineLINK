import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models
from database import Base, engine
from routers import (
    admin,
    asesor,
    diagnostico,
    empresas,
    eventos,
    inversionistas,
    leads,
    mineros,
    proyectos,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MineLink API")

origenes = [
    "http://127.0.0.1:5173",
    # La app empaquetada con Capacitor sirve el HTML desde estos
    # orígenes locales (Android usa localhost sin puerto; https es el
    # esquema por defecto de Capacitor, http era el de desarrollo local).
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
]
# Cuando el frontend tenga dominio/hosting real, definir FRONTEND_URL en
# backend/.env o en el panel del hosting (ej. https://minelink.pe) — sin
# tocar este archivo. Se limpian espacios/comillas/barra final porque los
# paneles de hosting suelen colarlos al pegar el valor.
frontend_url = os.environ.get("FRONTEND_URL", "").strip().strip('"').strip("'").rstrip("/")
if frontend_url:
    origenes.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes,
    # El frontend de producción vive en Vercel (mine-link-seven.vercel.app y
    # sus URLs de preview mine-link-seven-*.vercel.app) — se aceptan por
    # regex para no depender solo de la variable FRONTEND_URL.
    allow_origin_regex=r"https://mine-link-[a-z0-9-]+\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diagnostico.router)
app.include_router(asesor.router)
app.include_router(eventos.router)
app.include_router(empresas.router)
app.include_router(leads.router)
app.include_router(mineros.router)
app.include_router(inversionistas.router)
app.include_router(proyectos.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
