from fastapi import APIRouter, HTTPException
from app.services.settings_service import settings_service, SettingsPayload

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsPayload)
def get_settings():
    return settings_service.get_settings()


@router.post("")
def save_settings(payload: SettingsPayload):
    try:
        return settings_service.save_settings(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reindex")
def reindex_all():
    try:
        return settings_service.reindex_all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
