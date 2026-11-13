from fastapi import APIRouter, HTTPException
from app.schemas.query import SearchQuery, AskRequest, AskResponse
from app.schemas.chunk import SourceCitation
from app.services.search_service import search_service

router = APIRouter(tags=["Search & QA"])


@router.post("/search", response_model=list[SourceCitation])
def search(query: SearchQuery):
    try:
        return search_service.search(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ask", response_model=AskResponse)
def ask(request: AskRequest):
    try:
        return search_service.ask(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

