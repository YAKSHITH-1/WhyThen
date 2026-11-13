import re
from datetime import datetime
from typing import Optional, Tuple
from dateutil import parser as date_parser

# Regex patterns for common date formats in personal notes
DATE_CORE_PATTERNS = [
    # YYYY-MM-DD or YYYY/MM/DD
    r"20\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])",
    # Month DD, YYYY (e.g. March 6, 2026 or Mar 6, 2026)
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+[0-2]?\d,?\s+20\d{2}",
    # DD Month YYYY (e.g. 6 March 2026)
    r"[0-2]?\d\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+20\d{2}",
]

DATE_PATTERNS = [rf"\b({p})\b" for p in DATE_CORE_PATTERNS]

# Combined keyword prefix pattern for high-confidence event dates
KEYWORD_PREFIX = r"(?i)\b(?:date|decided(?:\s+on)?|as\s+of|meeting\s+date|log\s+for)[:\s]+"
HIGH_CONF_PATTERN = rf"{KEYWORD_PREFIX}({'|'.join(DATE_CORE_PATTERNS)})"

# Frontmatter date patterns: date: 2026-03-06
FRONTMATTER_DATE_PATTERN = r"(?im)^date:\s*[\"']?([^\r\n\"']+)[\"']?"


def extract_frontmatter_date(text: str) -> Optional[str]:
    match = re.search(FRONTMATTER_DATE_PATTERN, text)
    if match:
        raw_val = match.group(1).strip()
        try:
            parsed = date_parser.parse(raw_val, fuzzy=True)
            return parsed.strftime("%Y-%m-%d")
        except Exception:
            pass
    return None


def extract_event_date(text: str) -> Tuple[Optional[str], str]:
    """
    Extract the most prominent event date from a chunk or section of text.
    Returns (date_str_YYYY-MM-DD, confidence_level: 'high' | 'medium' | 'low').
    """
    # 1. Check for explicit keywords with dates like "Decided on 2026-03-06" or "Date: March 6, 2026"
    keyword_match = re.search(HIGH_CONF_PATTERN, text)
    if keyword_match:
        candidate = keyword_match.group(1).strip()
        try:
            parsed = date_parser.parse(candidate, fuzzy=True)
            if 2000 <= parsed.year <= 2050:
                return parsed.strftime("%Y-%m-%d"), "high"
        except Exception:
            pass

    # 2. Check general date patterns in the text
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(0)
            try:
                parsed = date_parser.parse(candidate, fuzzy=True)
                if 2000 <= parsed.year <= 2050:
                    return parsed.strftime("%Y-%m-%d"), "medium"
            except Exception:
                continue

    return None, "low"


def format_iso_date(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

