from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import os
from datetime import datetime

from app.core.database import get_db
from app.services.retrieval.search import RetrievalService
from app.services.llm.generator import GeminiLLMService
from app.models.document import Document

from sqlalchemy.future import select
from sqlalchemy import desc
from app.models.chat import ChatSession, ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    question: str
    document_ids: Optional[List[str]] = None

class Source(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    chunk_id: str
    excerpt: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]

class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    sources: Optional[List[Source]] = None
    created_at: str

@router.post("/sessions", response_model=SessionResponse)
async def create_session(db: AsyncSession = Depends(get_db)):
    session = ChatSession(title="New Chat")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse(id=session.id, title=session.title, created_at=session.created_at.isoformat())

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).order_by(desc(ChatSession.updated_at)))
    sessions = result.scalars().all()
    return [SessionResponse(id=s.id, title=s.title, created_at=s.created_at.isoformat()) for s in sessions]

@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at))
    messages = result.scalars().all()
    return [MessageResponse(
        id=m.id, 
        role=m.role, 
        content=m.content, 
        sources=[Source(**s) for s in m.sources] if m.sources else None,
        created_at=m.created_at.isoformat()
    ) for m in messages]

@router.post("/sessions/{session_id}/messages", response_model=ChatResponse)
async def chat(session_id: str, request: ChatRequest, db: AsyncSession = Depends(get_db)):
    # Validate session
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update session title if it's the first message
    msg_result = await db.execute(select(ChatMessage).where(ChatMessage.session_id == session_id))
    has_messages = msg_result.first() is not None
    if not has_messages:
        session.title = request.question[:30] + ("..." if len(request.question) > 30 else "")
        session.updated_at = datetime.utcnow()

    # Save User message
    user_msg = ChatMessage(session_id=session_id, role="user", content=request.question)
    db.add(user_msg)

    # Retrieval
    retrieval_service = RetrievalService(db, top_k=int(os.getenv("RAG_TOP_K", 5)))
    chunks = await retrieval_service.search(request.question, request.document_ids)
    
    if not chunks:
        answer = "I couldn't find any relevant information in the provided documents."
        sources = []
    else:
        sources = []
        for chunk in chunks:
            sources.append(Source(
                document_id=chunk.document_id,
                document_name=chunk.document.filename if chunk.document else f"Doc {chunk.document_id}",
                page_number=chunk.page_number,
                chunk_id=chunk.id,
                excerpt=chunk.content[:200] + "..."
            ))
        
        # Generate Answer
        llm = GeminiLLMService()
        answer = llm.generate_answer(request.question, chunks)

    # Save Assistant message
    assistant_msg = ChatMessage(
        session_id=session_id, 
        role="assistant", 
        content=answer,
        sources=[s.model_dump() for s in sources]
    )
    db.add(assistant_msg)
    
    session.updated_at = datetime.utcnow()
    await db.commit()

    return ChatResponse(answer=answer, sources=sources)
