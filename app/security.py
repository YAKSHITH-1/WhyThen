import os
import re
import uuid
from pathlib import Path
from typing import Set

class SecurityError(ValueError):
    """Raised when a path or file violates security constraints."""
    pass

# Forbidden path substrings or base directory names (case-insensitive)
FORBIDDEN_DIR_NAMES = {
    ".ssh",
    ".aws",
    ".gnupg",
    ".git",
    "windows",
    "system32",
    "program files",
    "program files (x86)",
    "etc",
    "var",
    "proc",
    "sys",
    "bin",
    "sbin",
}

ALLOWED_EXTENSIONS: Set[str] = {".md", ".markdown", ".txt", ".pdf"}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB limit per uploaded file


def validate_safe_directory(path_input: str | Path) -> Path:
    """
    Validate that an absolute or relative directory path is safe for scanning.
    Guards against:
    - Path traversal
    - Non-existent or non-directory paths
    - System roots ('/', 'C:\\', 'D:\\')
    - Sensitive directories (.ssh, .aws, Windows, etc.)
    - Dangerous symlinks
    """
    if not path_input:
        raise SecurityError("Directory path cannot be empty.")

    raw_path = Path(path_input)
    try:
        # Resolve path completely, dereferencing symlinks
        resolved_path = raw_path.resolve(strict=True)
    except FileNotFoundError:
        raise SecurityError(f"Directory does not exist: {path_input}")
    except Exception as e:
        raise SecurityError(f"Cannot access directory: {e}")

    if not resolved_path.is_dir():
        raise SecurityError(f"Path is not a directory: {resolved_path}")

    # Check root drive traversal: cannot scan whole root
    if resolved_path == resolved_path.anchor or resolved_path.parent == resolved_path:
        raise SecurityError(f"Scanning an entire filesystem root drive is prohibited: {resolved_path}")

    # Inspect all path parts for sensitive names
    for part in resolved_path.parts:
        clean_part = part.strip().lower()
        if clean_part in FORBIDDEN_DIR_NAMES:
            raise SecurityError(f"Access to sensitive or system directory '{part}' is prohibited: {resolved_path}")

    # Check Windows-specific system paths
    windir = os.environ.get("WINDIR")
    if windir and Path(windir).resolve() in resolved_path.parents or (windir and resolved_path == Path(windir).resolve()):
        raise SecurityError(f"Access to Windows system directory is prohibited: {resolved_path}")

    # Check user home sensitive folders (.ssh, .aws)
    user_home = Path.home().resolve()
    for sensitive in [".ssh", ".aws", ".gnupg"]:
        sensitive_dir = user_home / sensitive
        if sensitive_dir.exists():
            if resolved_path == sensitive_dir or sensitive_dir in resolved_path.parents:
                raise SecurityError(f"Access to sensitive credential folder '{sensitive}' is prohibited: {resolved_path}")

    return resolved_path


def sanitize_upload_filename(raw_filename: str) -> str:
    """
    Sanitize and prefix an uploaded filename.
    Guards against:
    - Path traversal (e.g. '../../malicious.sh')
    - Unsupported file extensions
    - Special shell/filesystem control characters
    """
    if not raw_filename:
        raise SecurityError("Upload filename cannot be empty.")

    # Strip any directory traversal components
    base_name = Path(raw_filename).name

    # Validate extension
    suffix = Path(base_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise SecurityError(f"Unsupported file extension '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # Clean the stem (letters, numbers, hyphens, underscores)
    stem = Path(base_name).stem
    clean_stem = re.sub(r"[^a-zA-Z0-9_\-]", "_", stem).strip("_")
    if not clean_stem:
        clean_stem = "upload"

    # Truncate overly long stems to avoid OS max path limit
    clean_stem = clean_stem[:60]

    # Prepend unique hex token to prevent file overwrite collisions
    unique_prefix = uuid.uuid4().hex[:8]
    return f"{unique_prefix}_{clean_stem}{suffix}"


def validate_file_size(size_in_bytes: int) -> None:
    if size_in_bytes > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        raise SecurityError(f"File size exceeds maximum allowed limit of {max_mb} MB.")
