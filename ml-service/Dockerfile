FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding model so RAG works offline on first request
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY ml_service ./ml_service

ENV PYTHONPATH=/app
EXPOSE 8000

CMD ["uvicorn", "ml_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
