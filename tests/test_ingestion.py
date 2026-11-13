from pathlib import Path
from app.ingestion.metadata import extract_event_date, extract_frontmatter_date
from app.ingestion.chunker import split_into_sections, chunk_section
from app.ingestion.scanner import compute_sha256


def test_date_extraction():
    text_explicit = "Decided on 2026-03-06 to adopt SQLite FTS5."
    date_val, conf = extract_event_date(text_explicit)
    assert date_val == "2026-03-06"
    assert conf == "high"

    text_month_name = "Meeting held on March 15, 2026."
    date_val2, conf2 = extract_event_date(text_month_name)
    assert date_val2 == "2026-03-15"
    assert conf2 == "medium"

    frontmatter = "---\ntitle: 'Test'\ndate: 2026-04-01\n---"
    fm_date = extract_frontmatter_date(frontmatter)
    assert fm_date == "2026-04-01"


def test_section_splitting():
    md_content = """# Main Title

Introductory paragraph.

## Section 1
First point under section 1.

## Section 2
Second point under section 2.
"""
    sections = split_into_sections(md_content)
    assert len(sections) == 3
    assert sections[0][0] == "Main Title"
    assert "Introductory" in sections[0][1]
    assert sections[1][0] == "Section 1"
    assert sections[2][0] == "Section 2"

