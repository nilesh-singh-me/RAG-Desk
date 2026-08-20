from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models.document import DocumentChunk
from app.services.embeddings.gemini import GeminiEmbeddingService

class RetrievalService:
    def __init__(self, db: AsyncSession, top_k: int = 5):
        self.db = db
        self.top_k = top_k
        self.embedder = GeminiEmbeddingService()

    async def search(self, query: str, document_ids: list[str] = None) -> list[DocumentChunk]:
        query_embedding = self.embedder.embed_query(query)
        
        # pgvector uses `<->` for L2 distance, `<#>` for inner product, `<=>` for cosine distance
        # We will use cosine distance for embeddings
        stmt = select(DocumentChunk).options(selectinload(DocumentChunk.document))
        
        if document_ids:
            stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))
            
        stmt = stmt.order_by(DocumentChunk.embedding.cosine_distance(query_embedding)).limit(self.top_k)
        
        result = await self.db.execute(stmt)
        return result.scalars().all()
