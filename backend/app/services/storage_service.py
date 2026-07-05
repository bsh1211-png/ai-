import uuid
from pathlib import Path

STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage"


class LocalStorageService:
    """로컬 파일시스템 저장소 (개발용)."""

    def __init__(self, root: Path = STORAGE_ROOT) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def save_bytes(self, subdir: str, content: bytes, suffix: str = ".jpg") -> str:
        directory = self.root / subdir
        directory.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}{suffix}"
        path = directory / filename
        path.write_bytes(content)
        return str(Path(subdir) / filename)

    def read_bytes(self, relative_path: str) -> bytes:
        return (self.root / relative_path).read_bytes()

    def delete(self, relative_path: str) -> None:
        path = self.root / relative_path
        if path.exists():
            path.unlink()


class SupabaseStorageService:
    """Supabase Storage 기반 저장소 (프로덕션용)."""

    _CONTENT_TYPES: dict[str, str] = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }

    def __init__(self, url: str, key: str, bucket: str) -> None:
        from supabase import create_client
        self._client = create_client(url, key)
        self._bucket = bucket
        try:
            self._client.storage.create_bucket(bucket, options={"public": False})
        except Exception:
            pass  # 버킷이 이미 존재하면 무시

    def save_bytes(self, subdir: str, content: bytes, suffix: str = ".jpg") -> str:
        filename = f"{uuid.uuid4()}{suffix}"
        path = f"{subdir}/{filename}"
        content_type = self._CONTENT_TYPES.get(suffix.lower(), "application/octet-stream")
        self._client.storage.from_(self._bucket).upload(
            path, content, {"content-type": content_type}
        )
        return path

    def read_bytes(self, relative_path: str) -> bytes:
        return self._client.storage.from_(self._bucket).download(relative_path)

    def delete(self, relative_path: str) -> None:
        self._client.storage.from_(self._bucket).remove([relative_path])


def _make_storage_service() -> LocalStorageService | SupabaseStorageService:
    import logging
    from app.config import settings

    url = settings.supabase_url.strip()
    key = settings.supabase_service_key.strip()

    # URL 유효성 간단 검사 후 초기화 시도
    if url.startswith("https://") and "supabase.co" in url and key:
        try:
            svc = SupabaseStorageService(url, key, settings.supabase_storage_bucket)
            logging.info("Supabase Storage 사용")
            return svc
        except Exception as e:
            logging.warning(f"Supabase Storage 초기화 실패, 로컬 저장소로 폴백: {e}")

    logging.info("LocalStorageService 사용")
    return LocalStorageService()


storage_service = _make_storage_service()
