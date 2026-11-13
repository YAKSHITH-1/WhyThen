from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.chunk import SourceCitation


class DecisionRecord(BaseModel):
    id: str
    project: Optional[str] = None
    entity: Optional[str] = None
    decision_text: str
    chosen_option: Optional[str] = None
    alternatives: List[str] = Field(default_factory=list)
    rationale: Optional[str] = None
    event_date: Optional[str] = None
    confidence: float = 1.0
    source_chunk_id: str
    source_path: str = ""


class DecisionTimelineItem(BaseModel):
    event_date: Optional[str] = None
    decision: str
    chosen_option: Optional[str] = None
    rationale: Optional[str] = None
    status_or_relation: str = "initial_choice"  # "initial_choice", "revises", "supersedes", "confirms"
    citations: List[SourceCitation] = Field(default_factory=list)


class DecisionTimelineResponse(BaseModel):
    topic: str
    summary: str
    timeline: List[DecisionTimelineItem] = Field(default_factory=list)
    unresolved_questions: List[str] = Field(default_factory=list)

