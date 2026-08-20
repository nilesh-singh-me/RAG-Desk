.PHONY: start-backend start-frontend start

start-backend:
	cd backend && source venv/bin/activate && uvicorn app.main:app --reload

start-frontend:
	cd frontend && npm run dev

start:
	docker compose up -d
	make -j 2 start-backend start-frontend
