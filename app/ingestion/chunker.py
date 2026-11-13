import re
from typing import List, Optional
from app.config import settings
from app.schemas.chunk import ChunkRecord
from app.ingestion.metadata import extract_event_date


def split_into_sections(text: str) -> List[tuple[Optional[str], str]]:
    """
    Split markdown/text into sections delineated by headings.
    Returns tuples of (heading, content).
    """
    lines = text.split("\n")
    sections = []
    current_heading = None
    current_lines = []

    heading_regex = re.compile(r"^(#{1,6})\s+(.+)$")

    for line in lines:
        match = heading_regex.match(line)
        if match:
            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    sections.append((current_heading, content))
                current_lines = []
            current_heading = match.group(2).strip()
        else:
            current_lines.append(line)

    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            sections.append((current_heading, content))

    if not sections and text.strip():
        sections.append((None, text.strip()))

    return sections


def chunk_section(
    heading: Optional[str],
    text: str,
    target_words: int = 450,
    overlap_words: int = 70,
) -> List[tuple[Optional[str], str]]:
    """Chunk a section's text into windows with overlap, respecting paragraph breaks."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    chunks = []
    current_paras: list[str] = []
    current_word_count = 0

    for para in paragraphs:
        para_words = len(para.split())
        # If single paragraph is very large, split it by sentences/words
        if para_words > target_words:
            words = para.split()
            step = target_words - overlap_words
            for i in range(0, len(words), max(1, step)):
                chunk_slice = " ".join(words[i : i + target_words])
                chunks.append((heading, chunk_slice))
            continue

        if current_word_count + para_words > target_words and current_paras:
            # Yield current chunk
            chunk_body = "\n\n".join(current_paras)
            chunks.append((heading, chunk_body))

            # Maintain overlap with the last paragraph(s)
            overlap_paras = []
            overlap_count = 0
            for p in reversed(current_paras):
                p_len = len(p.split())
                if overlap_count + p_len <= overlap_words or not overlap_paras:
                    overlap_paras.insert(0, p)
                    overlap_count += p_len
                else:
                    break
            current_paras = overlap_paras
            current_word_count = overlap_count

        current_paras.append(para)
        current_word_count += para_words

    if current_paras:
        chunk_body = "\n\n".join(current_paras)
        chunks.append((heading, chunk_body))

    return chunks


def create_chunks_for_document(
    document_id: str,
    parsed_pages: List[tuple[int | None, str]],
    source_path: str,
    title: Optional[str] = None,
    document_date: Optional[str] = None,
) -> List[ChunkRecord]:
    """Process parsed pages and create structured ChunkRecord objects."""
    chunk_records: List[ChunkRecord] = []
    chunk_counter = 0

    for page_num, page_content in parsed_pages:
        sections = split_into_sections(page_content)
        for heading, sec_text in sections:
            section_chunks = chunk_section(
                heading=heading,
                text=sec_text,
                target_words=settings.CHUNK_SIZE,
                overlap_words=settings.CHUNK_OVERLAP,
            )

            for chunk_heading, chunk_body in section_chunks:
                # Prepend heading to chunk text for enhanced semantic and lexical context
                formatted_text = f"## {chunk_heading}\n\n{chunk_body}" if chunk_heading else chunk_body

                event_date, confidence = extract_event_date(formatted_text)
                if not event_date and document_date:
                    event_date = document_date
                    confidence = "medium"

                chunk_id = f"{document_id}_c{chunk_counter}"
                chunk_records.append(
                    ChunkRecord(
                        id=chunk_id,
                        document_id=document_id,
                        chunk_index=chunk_counter,
                        text=formatted_text,
                        heading=chunk_heading,
                        page_number=page_num,
                        event_date=event_date,
                        date_confidence=confidence,
                        source_path=source_path,
                        title=title,
                    )
                )
                chunk_counter += 1

    return chunk_records

