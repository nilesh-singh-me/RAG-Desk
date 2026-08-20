import os
from google import genai
from app.models.document import DocumentChunk

class GeminiLLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        self.client = genai.Client(api_key=self.api_key)
        self.model = os.getenv("LLM_MODEL", "gemini-2.5-flash")

    def generate_answer(self, question: str, chunks: list[DocumentChunk]) -> str:
        # Build Context
        context_parts = []
        for chunk in chunks:
            # We can use metadata to show file/page. We can assume we have document joined or metadata has it.
            # For this simple prompt, we'll just concat text.
            context_parts.append(f"--- Excerpt from page {chunk.page_number} ---\n{chunk.content}")
        
        context_str = "\n\n".join(context_parts)
        
        prompt = f"""You are a document question-answering assistant.

Answer the user's question using only the provided document context.

If the answer cannot be found in the provided context, clearly say that the information was not found in the uploaded documents.

Do not invent facts.

When possible, reference the document name and page number.

Context:
{context_str}

Question:
{question}
"""
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt
        )
        return response.text
