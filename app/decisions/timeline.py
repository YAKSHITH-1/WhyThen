import json
import re
from typing import List, Optional
from app.schemas.chunk import ChunkRecord, SourceCitation
from app.schemas.decision import DecisionTimelineItem, DecisionTimelineResponse
from app.generation.llm import LLMClient, llm_client
from app.generation.prompts import DECISION_SYNTHESIS_SYSTEM_PROMPT


class DecisionTimelineBuilder:
    def __init__(self, client: LLMClient = llm_client):
        self.client = client

    def build_timeline(
        self, topic: str, chunks: List[ChunkRecord]
    ) -> DecisionTimelineResponse:
        if not chunks:
            return DecisionTimelineResponse(
                topic=topic,
                summary=f"No recorded notes or decisions found for '{topic}'.",
                timeline=[],
                unresolved_questions=[],
            )

        # Ensure chunks are ordered chronologically
        sorted_chunks = sorted(
            chunks,
            key=lambda c: (c.event_date or "9999-12-31", c.chunk_index),
        )

        chunk_dict = {c.id: c for c in sorted_chunks}

        # Build chronological context block
        lines = []
        for c in sorted_chunks:
            date_str = c.event_date or "Date Unspecified"
            heading_str = f" [{c.heading}]" if c.heading else ""
            lines.append(f"--- Chunk ID: {c.id} | Date: {date_str}{heading_str} ---")
            lines.append(c.text)
            lines.append("")

        context_str = "\n".join(lines)
        user_prompt = (
            f"Topic: {topic}\n\n"
            f"Chronological Notes:\n{context_str}\n\n"
            f"Extract the decision timeline in the requested JSON format."
        )

        raw_output = self.client.generate(DECISION_SYNTHESIS_SYSTEM_PROMPT, user_prompt)

        # Attempt JSON parse
        try:
            # Extract JSON block if surrounded by markdown code fences
            json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_output, re.DOTALL)
            json_text = json_match.group(1) if json_match else raw_output.strip()
            data = json.loads(json_text)

            timeline_items = []
            for item in data.get("timeline", []):
                cited_chunks = [
                    chunk_dict[cid]
                    for cid in item.get("citation_ids", [])
                    if cid in chunk_dict
                ]
                citations = [
                    SourceCitation(
                        chunk_id=c.id,
                        source_path=c.source_path,
                        title=c.title,
                        heading=c.heading,
                        event_date=c.event_date,
                        excerpt=c.text[:300] + ("..." if len(c.text) > 300 else ""),
                    )
                    for c in cited_chunks
                ]

                timeline_items.append(
                    DecisionTimelineItem(
                        event_date=item.get("event_date"),
                        decision=item.get("decision", ""),
                        chosen_option=item.get("chosen_option"),
                        rationale=item.get("rationale"),
                        status_or_relation=item.get("status_or_relation", "initial_choice"),
                        citations=citations,
                    )
                )

            return DecisionTimelineResponse(
                topic=data.get("topic", topic),
                summary=data.get("summary", ""),
                timeline=timeline_items,
                unresolved_questions=data.get("unresolved_questions", []),
            )
        except Exception:
            # Fallback to heuristic chronological timeline extraction
            return self._heuristic_fallback(topic, sorted_chunks)

    def _heuristic_fallback(
        self, topic: str, chunks: List[ChunkRecord]
    ) -> DecisionTimelineResponse:
        timeline_items = []
        keywords = ["decided", "chose", "selected", "switched", "replacing", "instead of", "plan to", "will use"]

        for c in chunks:
            text_lower = c.text.lower()
            if any(k in text_lower for k in keywords):
                # Simple extraction of key sentence
                sentences = [s.strip() for s in re.split(r"[.!?]\s+", c.text) if s.strip()]
                matched_sentences = [
                    s for s in sentences if any(k in s.lower() for k in keywords)
                ]
                dec_text = matched_sentences[0] if matched_sentences else c.text[:150]

                relation = "revises" if any(w in text_lower for w in ["switched", "instead", "changed", "replace"]) else "initial_choice"

                timeline_items.append(
                    DecisionTimelineItem(
                        event_date=c.event_date,
                        decision=dec_text,
                        status_or_relation=relation,
                        citations=[
                            SourceCitation(
                                chunk_id=c.id,
                                source_path=c.source_path,
                                title=c.title,
                                heading=c.heading,
                                event_date=c.event_date,
                                excerpt=c.text[:300] + ("..." if len(c.text) > 300 else ""),
                            )
                        ],
                    )
                )

        summary = (
            f"Found {len(timeline_items)} chronological decision points for '{topic}'."
            if timeline_items
            else f"No explicit decisions or rationale found for '{topic}'."
        )

        return DecisionTimelineResponse(
            topic=topic,
            summary=summary,
            timeline=timeline_items,
            unresolved_questions=[],
        )


decision_builder = DecisionTimelineBuilder()

