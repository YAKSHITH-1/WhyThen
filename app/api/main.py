from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, APIRouter, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import httpx

from app.config import settings
from app.storage.database import db_manager
from app.services.reconciliation_service import reconciliation_service
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_ingest import router as ingest_router
from app.api.routes_search import router as search_router
from app.api.routes_decisions import router as decisions_router
from app.api.routes_settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize SQLite database & migrations
    db_manager.initialize()
    # 2. Reconcile SQLite chunks with ChromaDB vector store
    reconciliation_service.reconcile()
    yield


app = FastAPI(
    title="WhyThen API",
    description="A Local-First, Time-Aware Personal Memory & Decision History Assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# Blocker 4: Restrict CORS strictly to local development origins
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def check_health_status() -> dict:
    db_status = "error"
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.execute("SELECT 1")
            if cursor.fetchone():
                db_status = "connected"
    except Exception as e:
        db_status = f"unreachable: {e}"

    ollama_status = "unreachable"
    try:
        with httpx.Client(timeout=1.5) as client:
            res = client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags")
            if res.status_code == 200:
                ollama_status = "connected"
    except Exception:
        pass

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "app": "WhyThen",
        "version": "0.1.0",
        "database": db_status,
        "ollama": ollama_status,
    }


# Health check at both root and under /api
@app.get("/health")
def health_root():
    return check_health_status()


# Blocker 1: Mount all backend endpoints under unified /api prefix
api_router = APIRouter(prefix="/api")
api_router.get("/health")(health_root)
api_router.include_router(dashboard_router)
api_router.include_router(ingest_router)
api_router.include_router(search_router)
api_router.include_router(decisions_router)
api_router.include_router(settings_router)

app.include_router(api_router)

# Blocker 7: Production SPA Fallback Routing
FRONTEND_DIST = Path("frontend/dist").resolve()

if FRONTEND_DIST.exists():
    # Mount assets directory if present
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Catch-all route serving index.html for client-side routing
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # Do not intercept API requests
        if full_path.startswith("api/") or full_path == "api" or full_path == "health":
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Not Found"})

        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)

        index_file = FRONTEND_DIST / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)

        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Index file not found"})
