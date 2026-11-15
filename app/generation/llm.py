import json
import re
from typing import Optional, List, Dict, Any
import httpx
from app.config import settings


class LLMClient:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.openai_key = settings.OPENAI_API_KEY
        self.openai_url = settings.OPENAI_BASE_URL or "https://api.openai.com/v1"

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        if self.provider == "ollama":
            return self._call_ollama(system_prompt, user_prompt)
        elif self.provider == "openai":
            return self._call_openai(system_prompt, user_prompt)
        else:
            return self._call_mock(system_prompt, user_prompt)

    def _call_ollama(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.ollama_url.rstrip('/')}/api/generate"
        payload = {
            "model": self.model,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
        }
        try:
            with httpx.Client(timeout=180.0) as client:
                res = client.post(url, json=payload)
                res.raise_for_status()
                return res.json().get("response", "")
        except Exception as e:
            # Fallback to mock with clear warning if Ollama is unreachable
            return (
                f"[Note: Local Ollama daemon at {self.ollama_url} was unreachable: {e}. "
                f"Falling back to grounded extraction]\n\n"
                + self._call_mock(system_prompt, user_prompt)
            )

    def _call_openai(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.openai_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.0,
        }
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(url, headers=headers, json=payload)
                res.raise_for_status()
                data = res.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            return f"Error contacting API: {e}"

    def _call_mock(self, system_prompt: str, user_prompt: str) -> str:
        """Deterministic fallback when no LLM is available, ensuring grounding and honest citations."""
        # Check if user_prompt has excerpts
        if "Context Excerpts:" in user_prompt:
            parts = user_prompt.split("Context Excerpts:")[1].split("User Question:")
            excerpts_part = parts[0]
            question_part = parts[1].strip() if len(parts) > 1 else ""

            # Check if any substantive keyword from the question appears in the excerpts
            q_words = [w.lower() for w in re.findall(r"\b[A-Za-z0-9_-]{3,}\b", question_part)]
            stopwords = {"what", "when", "where", "which", "who", "whom", "whose", "why", "how", "did", "the", "and", "for", "with", "about", "your", "our", "are", "was", "were", "you", "not", "have", "had"}
            meaningful_words = [w for w in q_words if w not in stopwords]

            excerpts_lower = excerpts_part.lower()
            overlap = [w for w in meaningful_words if w in excerpts_lower]

            if not overlap:
                return "Based on your notes, no supporting record or explanation was found."

            chunk_matches = re.findall(r"\[Excerpt ([^\s|\]]+)", excerpts_part)
            if not chunk_matches:
                return "Based on your notes, no supporting record or explanation was found."

            first_chunk_id = chunk_matches[0]
            return (
                f"According to your recorded notes [{first_chunk_id}], "
                f"the relevant decision and details regarding {', '.join(overlap[:3])} were documented. "
                f"Refer to the cited excerpts for the complete context."
            )

        return "Based on your notes, no supporting record or explanation was found."


llm_client = LLMClient()

