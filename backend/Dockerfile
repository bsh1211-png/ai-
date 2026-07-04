FROM python:3.13-slim

WORKDIR /app

# mediapipe 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# MediaPipe pose 모델 다운로드 (빌드 시 1회)
RUN python -m scripts.download_pose_model

RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
