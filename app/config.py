from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="WHYTHEN_", env_file=".env", extra="ignore")

    # Project directories
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = Path("data")
    SQLITE_PATH: Path = Path("data/sqlite/whythen.db")
    CHROMA_DIR: Path = Path("data/chroma")

    # Embedding configuration
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # LLM configuration
    LLM_PROVIDER: Literal["ollama", "openai", "mock"] = "ollama"
    LLM_MODEL: str = "llama3.2"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""

    # Ingestion & Chunking parameters
    CHUNK_SIZE: int = 500  # Target tokens/approx words
    CHUNK_OVERLAP: int = 80
    SUPPORTED_EXTENSIONS: list[str] = [".md", ".txt", ".pdf"]

    def ensure_directories(self) -> None:
        """Ensure necessary data directories exist."""
        self.SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.CHROMA_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()

