import fitz  # PyMuPDF
import re

class DocumentProcessor:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_text(self, file_path: str) -> list[dict]:
        """
        Extracts text from a PDF, preserving page boundaries.
        Returns a list of dicts with 'page_number' and 'text'.
        """
        pages = []
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            # Basic cleaning
            text = re.sub(r'\s+', ' ', text).strip()
            if text:
                pages.append({
                    "page_number": page_num + 1,
                    "text": text
                })
        return pages

    def chunk_text(self, pages: list[dict], document_id: str) -> list[dict]:
        """
        Chunks the text from pages using the configured size and overlap.
        (Note: a proper token-based chunker would use tiktoken, but for this demo 
        we use simple word/character splitting as a proxy, or naive char splitting)
        """
        chunks = []
        chunk_index = 0
        
        for page in pages:
            text = page["text"]
            # Rough approximation: 1 token ~ 4 chars
            # So 800 tokens = 3200 chars. Let's use simple character splitting.
            char_size = self.chunk_size * 4
            char_overlap = self.chunk_overlap * 4
            
            start = 0
            while start < len(text):
                end = start + char_size
                chunk_text = text[start:end]
                
                chunks.append({
                    "document_id": document_id,
                    "page_number": page["page_number"],
                    "chunk_index": chunk_index,
                    "text": chunk_text
                })
                
                chunk_index += 1
                start += (char_size - char_overlap)
                
        return chunks

    def process_pdf(self, file_path: str, document_id: str) -> list[dict]:
        pages = self.extract_text(file_path)
        chunks = self.chunk_text(pages, document_id)
        return chunks
