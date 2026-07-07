import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models
from database import Base, engine
from routers import admin, diagnostico, empresas, inversionistas, leads, mineros, proyectos

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MineLink API")

origenes = [
    "http://127.0.0.1:5173",
    # La app empaquetada con Capacitor sirve el HTML desde estos
    # orígenes locales (Android usa http://localhost, no un puerto).
    "http://localhost",
    "capacitor://localhost",
]
# Cuando el frontend tenga dominio/hosting real, definir FRONTEND_URL en
# backend/.env (ej. https://minelink.pe) — sin tocar este archivo.
if os.environ.get("FRONTEND_URL"):
    origenes.append(os.environ["FRONTEND_URL"].rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diagnostico.router)
app.include_router(empresas.router)
app.include_router(leads.router)
app.include_router(mineros.router)
app.include_router(inversionistas.router)
app.include_router(proyectos.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
