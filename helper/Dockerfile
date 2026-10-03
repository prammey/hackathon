# Prism helper for Cloud Run. Credentials come from the attached service account (no key files).
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080 PRISM_MODE=hosted
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY prism_helper ./prism_helper
COPY demo ./demo
RUN useradd --create-home prism
USER prism
CMD exec uvicorn prism_helper.app:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips="*"
