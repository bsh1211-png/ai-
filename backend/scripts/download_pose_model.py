"""MediaPipe PoseLandmarker 모델(.task) 파일을 다운로드.

git에는 바이너리를 커밋하지 않으므로 셋업 시 1회 실행 필요.
사용법: backend/ 에서 `python -m scripts.download_pose_model`
"""

import sys
from pathlib import Path

import requests

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)
TARGET_PATH = Path(__file__).resolve().parents[1] / "app" / "ml_models" / "pose_landmarker_lite.task"


def download() -> None:
    if TARGET_PATH.exists():
        print(f"이미 존재함: {TARGET_PATH}")
        return

    TARGET_PATH.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(MODEL_URL, timeout=60)
    response.raise_for_status()
    TARGET_PATH.write_bytes(response.content)
    print(f"다운로드 완료: {TARGET_PATH} ({len(response.content)} bytes)")


if __name__ == "__main__":
    sys.exit(download() or 0)
