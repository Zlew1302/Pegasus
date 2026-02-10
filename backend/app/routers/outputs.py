from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.output import TaskOutput
from app.models.task import Task
from app.schemas.output import TaskOutputCreate, TaskOutputResponse

router = APIRouter(tags=["outputs"])


@router.get("/api/tasks/{task_id}/outputs", response_model=list[TaskOutputResponse])
async def list_outputs(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskOutput)
        .where(TaskOutput.task_id == task_id)
        .order_by(TaskOutput.version.desc())
    )
    return [TaskOutputResponse.model_validate(o) for o in result.scalars().all()]


@router.post(
    "/api/tasks/{task_id}/outputs",
    response_model=TaskOutputResponse,
    status_code=201,
)
async def create_output(
    task_id: str, data: TaskOutputCreate, db: AsyncSession = Depends(get_db)
):
    # Verify task exists
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task nicht gefunden")

    # Get latest version
    latest = await db.execute(
        select(TaskOutput)
        .where(TaskOutput.task_id == task_id)
        .order_by(TaskOutput.version.desc())
        .limit(1)
    )
    latest_output = latest.scalar_one_or_none()
    version = (latest_output.version + 1) if latest_output else 1

    output = TaskOutput(
        id=str(uuid4()),
        task_id=task_id,
        version=version,
        **data.model_dump(),
    )
    db.add(output)
    await db.commit()
    await db.refresh(output)
    return TaskOutputResponse.model_validate(output)


@router.get("/api/outputs/{output_id}", response_model=TaskOutputResponse)
async def get_output(output_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TaskOutput).where(TaskOutput.id == output_id)
    )
    output = result.scalar_one_or_none()
    if not output:
        raise HTTPException(status_code=404, detail="Output nicht gefunden")
    return TaskOutputResponse.model_validate(output)
