from typing import List
from sentence_transformers import SentenceTransformer
from app.config import settings

_model_instance: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    global _model_instance
    if _model_instance is None:
        _model_instance = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model_instance


def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    model = get_embedding_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return embeddings.tolist()


def embed_query(query: str) -> List[float]:
    model = get_embedding_model()
    embedding = model.encode(query, convert_to_numpy=True, show_progress_bar=False)
    return embedding.tolist()

