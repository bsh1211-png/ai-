from datetime import datetime

from pydantic import BaseModel


class HistorySummaryResponse(BaseModel):
    summary: str
    generated_at: datetime
    has_enough_data: bool
