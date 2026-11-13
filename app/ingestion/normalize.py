import re
from typing import Optional, Tuple


def extract_title(text: str, default_filename: str) -> str:
    """Extract document title from markdown heading or frontmatter, fallback to filename."""
    # Check frontmatter title: title: "My Title"
    fm_match = re.search(r"(?im)^title:\s*[\"']?([^\r\n\"']+)[\"']?", text)
    if fm_match:
        return fm_match.group(1).strip()

    # Check top heading # Title
    heading_match = re.search(r"(?m)^#\s+(.+)$", text)
    if heading_match:
        return heading_match.group(1).strip()

    # Fallback to filename without extension
    clean_name = re.sub(r"\.[^.]+$", "", default_filename)
    return clean_name.replace("_", " ").replace("-", " ").title()


def normalize_text(text: str) -> str:
    """Normalize line endings, trim excessive spaces, preserving paragraph breaks."""
    # Convert CRLF to LF
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ consecutive newlines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip trailing whitespace on each line
    lines = [line.rstrip() for line in text.split("\n")]
    return "\n".join(lines).strip()

