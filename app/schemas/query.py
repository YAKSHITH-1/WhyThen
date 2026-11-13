from typing import Optional, List, Literal
from pydantic import BaseModel, Field
from app.schemas.chunk import SourceCitation
from app.schemas.decision import DecisionTimelineItem


class SearchQuery(BaseModel):
    text: str
    date_from: Optional[str] = None  # YYYY-MM-DD
    date_to: Optional[str] = None    # YYYY-MM-DD
    project: Optional[str] = None
    limit: int = 10
    semantic_weight: float = 0.50
    keyword_weight: float = 0.35
    temporal_weight: float = 0.15


class SearchResult(BaseModel):
    citations: List[SourceCitation]
    total_found: int


class AskRequest(BaseModel):
    question: str
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    project: Optional[str] = None
    answer_mode: Literal["standard", "decision_history", "unfinished_plans"] = "standard"


class AskResponse(BaseModel):
    answer: str
    coverage: Literal["supported", "partial", "no_evidence_found"]
    sources: List[SourceCitation] = Field(default_factory=list)
    timeline: List[DecisionTimelineItem] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)

