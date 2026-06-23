import io
import math
from pathlib import Path

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision as mp_vision
from PIL import Image

_MODEL_PATH = Path(__file__).resolve().parents[1] / "ml_models" / "pose_landmarker_lite.task"

# 좌우 대칭성 비교에 쓰는 landmark 쌍 (PoseLandmark index 기준)
_SYMMETRY_PAIRS = [
    (11, 12),  # shoulders
    (13, 14),  # elbows
    (23, 24),  # hips
    (25, 26),  # knees
]

LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
LEFT_HIP, RIGHT_HIP = 23, 24

_landmarker: mp_vision.PoseLandmarker | None = None


def _get_landmarker() -> mp_vision.PoseLandmarker:
    global _landmarker
    if _landmarker is None:
        if not _MODEL_PATH.exists():
            raise FileNotFoundError(
                f"pose 모델이 없습니다: {_MODEL_PATH}. "
                "`python -m scripts.download_pose_model` 실행 필요"
            )
        options = mp_vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(_MODEL_PATH)),
            running_mode=mp_vision.RunningMode.IMAGE,
        )
        _landmarker = mp_vision.PoseLandmarker.create_from_options(options)
    return _landmarker


def _distance(a, b) -> float:
    return math.dist((a.x, a.y), (b.x, b.y))


def analyze_pose(image_bytes: bytes) -> dict | None:
    """이미지 바이트를 받아 pose landmark 기반 정량 지표를 계산.

    감지된 사람이 없으면 None을 반환한다.
    """
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    array = np.array(pil_image)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=array)

    result = _get_landmarker().detect(mp_image)

    if not result.pose_landmarks:
        return None

    landmarks = result.pose_landmarks[0]
    landmarks_json = [
        {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility} for lm in landmarks
    ]

    shoulder_width = _distance(landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER])
    hip_width = _distance(landmarks[LEFT_HIP], landmarks[RIGHT_HIP])
    shoulder_width_ratio = shoulder_width / hip_width if hip_width > 0 else None

    symmetry_diffs = []
    for left_idx, right_idx in _SYMMETRY_PAIRS:
        left_vis = landmarks[left_idx].visibility
        right_vis = landmarks[right_idx].visibility
        if left_vis < 0.5 or right_vis < 0.5:
            continue
        symmetry_diffs.append(abs(landmarks[left_idx].y - landmarks[right_idx].y))

    limb_symmetry_score = (1 - min(sum(symmetry_diffs) / len(symmetry_diffs), 1)) if symmetry_diffs else None
    raw_confidence = sum(lm.visibility for lm in landmarks) / len(landmarks)

    return {
        "landmarks_json": landmarks_json,
        "shoulder_width_ratio": shoulder_width_ratio,
        "waist_hip_ratio": None,  # mediapipe 단일 landmark로는 허리둘레 추정 불가, 추후 별도 모델 필요
        "limb_symmetry_score": limb_symmetry_score,
        "posture_flags": {},
        "raw_confidence": raw_confidence,
    }
