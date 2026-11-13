from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes_ingest import router as ingest_router
from app.api.routes_search import router as search_router
from app.api.routes_decisions import router as decisions_router
from app.storage.database import db_manager

app = FastAPI(
    title="WhyThen API",
    description="A Local-First, Time-Aware Personal Memory & Decision History Assistant",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database schema on startup
@app.on_event("startup")
def on_startup():
    db_manager.initialize()

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "WhyThen", "version": "0.1.0"}

app.include_router(ingest_router)
app.include_router(search_router)
app.include_router(decisions_router)

