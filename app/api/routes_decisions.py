from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.schemas.decision import DecisionTimelineResponse
from app.services.decision_service import decision_service

router = APIRouter(prefix="/decisions", tags=["Decisions"])


@router.get("/timeline", response_model=DecisionTimelineResponse)
def get_timeline(
    topic: str = Query(..., description="Decision topic or entity to reconstruct"),
    date_from: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
):
    try:
        return decision_service.get_decision_timeline(topic, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

