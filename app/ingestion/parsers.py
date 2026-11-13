from pathlib import Path
from typing import List, Tuple
import pymupdf  # PyMuPDF


class ParseError(Exception):
    pass


def parse_markdown(file_path: Path) -> str:
    try:
        return file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise ParseError(f"Failed to read markdown file {file_path}: {e}") from e


def parse_txt(file_path: Path) -> str:
    try:
        return file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise ParseError(f"Failed to read text file {file_path}: {e}") from e


def parse_pdf(file_path: Path) -> List[Tuple[int, str]]:
    """Parse PDF file and return list of (page_number_1_indexed, text)."""
    try:
        doc = pymupdf.open(file_path)
        pages = []
        for i, page in enumerate(doc):
            page_text = page.get_text()
            if page_text.strip():
                pages.append((i + 1, page_text))
        doc.close()
        return pages
    except Exception as e:
        raise ParseError(f"Failed to parse PDF file {file_path}: {e}") from e


def parse_document(file_path: Path) -> List[Tuple[int | None, str]]:
    """Parse document based on suffix. Returns list of (page_number or None, content)."""
    suffix = file_path.suffix.lower()
    if suffix in [".md", ".markdown"]:
        return [(None, parse_markdown(file_path))]
    elif suffix == ".txt":
        return [(None, parse_txt(file_path))]
    elif suffix == ".pdf":
        return parse_pdf(file_path)
    else:
        raise ParseError(f"Unsupported file type: {suffix}")

