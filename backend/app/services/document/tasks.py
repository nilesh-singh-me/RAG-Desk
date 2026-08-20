from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.document import Document, DocumentChunk
from app.services.document.processor import DocumentProcessor
from app.services.embeddings.gemini import GeminiEmbeddingService
from app.core.database import async_session_maker
import traceback
import os

async def process_document_task(doc_id: str):
    async with async_session_maker() as db:
        try:
            # 1. Fetch document
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if not doc:
                print(f"Document {doc_id} not found for processing")
                return

            if not os.path.exists(doc.file_path):
                doc.status = "FAILED"
                doc.error_message = "File not found on disk"
                await db.commit()
                return

            # 2. Extract and Chunk
            processor = DocumentProcessor()
            chunks_data = processor.process_pdf(doc.file_path, doc_id)
            doc.page_count = max([c["page_number"] for c in chunks_data]) if chunks_data else 0

            # 3. Embed
            embedder = GeminiEmbeddingService()
            texts = [c["text"] for c in chunks_data]
            
            # Note: The API might have batch size limits, so we chunk the texts into smaller batches if needed
            # For simplicity, assuming the whole array can be embedded in one go or chunked in small batches
            batch_size = 100
            embeddings = []
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_embeddings = embedder.embed_documents(batch_texts)
                embeddings.extend(batch_embeddings)

            # 4. Save to DB
            for chunk_data, emb in zip(chunks_data, embeddings):
                db_chunk = DocumentChunk(
                    document_id=doc_id,
                    page_number=chunk_data["page_number"],
                    chunk_index=chunk_data["chunk_index"],
                    content=chunk_data["text"],
                    embedding=emb
                )
                db.add(db_chunk)

            # 5. Update Status
            doc.status = "READY"
            await db.commit()
            print(f"Document {doc_id} processed successfully")

        except Exception as e:
            await db.rollback()
            print(f"Error processing document {doc_id}: {traceback.format_exc()}")
            
            # Try to update status to failed
            try:
                result = await db.execute(select(Document).where(Document.id == doc_id))
                doc = result.scalar_one_or_none()
                if doc:
                    doc.status = "FAILED"
                    doc.error_message = str(e)
                    await db.commit()
            except Exception as inner_e:
                print(f"Failed to update error status: {inner_e}")
