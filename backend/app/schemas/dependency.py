from pydantic import BaseModel, ConfigDict


class DependencyCreate(BaseModel):
    depends_on_task_id: str


class DependencyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: str
    depends_on_task_id: str
    depends_on_title: str | None = None
    depends_on_status: str | None = None
