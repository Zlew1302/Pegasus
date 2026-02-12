from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BlockCreate(BaseModel):
    block_type: str = "paragraph"
    content: Optional[str] = None
    sort_order: int = 0
    indent_level: int = 0
    meta_json: Optional[str] = None


class BlockUpdate(BaseModel):
    block_type: Optional[str] = None
    content: Optional[str] = None
    sort_order: Optional[int] = None
    indent_level: Optional[int] = None
    meta_json: Optional[str] = None


class BlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    block_type: str
    content: Optional[str]
    sort_order: int
    indent_level: int
    meta_json: Optional[str]
    created_at: datetime
    updated_at: datetime


class BlockPosition(BaseModel):
    id: str
    sort_order: int


class BulkBlockReorder(BaseModel):
    positions: list[BlockPosition]


class DocumentCreate(BaseModel):
    title: str
    icon: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    icon: Optional[str] = None
    is_pinned: Optional[bool] = None


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    icon: Optional[str]
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    block_count: int = 0


class DocumentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    icon: Optional[str]
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    blocks: list[BlockResponse] = []
