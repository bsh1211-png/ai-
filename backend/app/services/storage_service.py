import uuid
from pathlib import Path

STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage"


class LocalStorageService:
    """로컬 파일시스템 저장소.

    프로덕션에서는 동일한 인터페이스(save_bytes/read_bytes/delete)를 유지한 채
    Supabase Storage/S3 presigned URL 방식으로 교체한다.
    """

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

    def absolute_path(self, relative_path: str) -> Path:
        return self.root / relative_path

    def delete(self, relative_path: str) -> None:
        path = self.root / relative_path
        if path.exists():
            path.unlink()


storage_service = LocalStorageService()
