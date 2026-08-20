# DocMind - Local AI PDF RAG Application

DocMind is a demonstration of a Retrieval-Augmented Generation (RAG) architecture using local PDF documents. The goal is to provide a clean, modern interface where users can upload PDFs, process them, and ask questions to an LLM, receiving answers supported by direct citations to the source material.

## Architecture

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack Query.
- **Backend**: Python FastAPI, SQLAlchemy, Pydantic.
- **Database**: PostgreSQL with `pgvector` for semantic similarity search.
- **LLM/Embeddings**: Uses Google Gemini API (`gemini-1.5-flash` for answering and `text-embedding-004` for vectors).

## Setup

1. Configure environment:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY to .env
   ```

2. Start the database:
   ```bash
   docker compose up -d
   ```

3. Setup backend dependencies:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   ```

4. Run the app:
   ```bash
   make start
   ```
