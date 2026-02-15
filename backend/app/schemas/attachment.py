from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    filename: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    uploaded_by: str
    created_at: datetime
