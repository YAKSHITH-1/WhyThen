import re
from typing import List, Tuple
from app.schemas.chunk import SourceCitation
from app.schemas.query import AskResponse
from app.generation.prompts import QA_SYSTEM_PROMPT, QA_USER_TEMPLATE
from app.generation.llm import LLMClient, llm_client


class AnswerGenerator:
    def __init__(self, client: LLMClient = llm_client):
        self.client = client

    def generate_answer(
        self, question: str, sources: List[SourceCitation]
    ) -> AskResponse:
        if not sources:
            return AskResponse(
                answer="Based on your notes, no supporting record or explanation was found.",
                coverage="no_evidence_found",
                sources=[],
                timeline=[],
                limitations=["No relevant notes matching the search criteria were found."],
            )

        # Assemble context pack
        context_blocks = []
        valid_chunk_ids = set()

        for s in sources:
            valid_chunk_ids.add(s.chunk_id)
            date_info = f" (Date: {s.event_date})" if s.event_date else ""
            heading_info = f" | Section: {s.heading}" if s.heading else ""
            block = (
                f"[Excerpt {s.chunk_id} | File: {s.source_path}{date_info}{heading_info}]\n"
                f"{s.excerpt}\n"
            )
            context_blocks.append(block)

        context_str = "\n".join(context_blocks)
        user_prompt = QA_USER_TEMPLATE.format(
            context_block=context_str, question=question
        )

        raw_answer = self.client.generate(QA_SYSTEM_PROMPT, user_prompt)

        # Citation validation: check which valid sources are cited in brackets in the answer
        verified_sources = [s for s in sources if f"[{s.chunk_id}]" in raw_answer]

        # Determine coverage
        if "no supporting record" in raw_answer.lower() or "no evidence found" in raw_answer.lower():
            coverage = "no_evidence_found"
        elif verified_sources:
            coverage = "supported"
        else:
            coverage = "partial"

        return AskResponse(
            answer=raw_answer,
            coverage=coverage,
            sources=verified_sources if verified_sources else sources[:3],
            timeline=[],
            limitations=[],
        )


answer_generator = AnswerGenerator()

