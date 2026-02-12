from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import UserTodo
from app.schemas.todo import TodoCreate, TodoResponse, TodoUpdate

router = APIRouter(prefix="/api/todos", tags=["todos"])


@router.get("", response_model=list[TodoResponse])
async def list_todos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserTodo).order_by(UserTodo.sort_order, UserTodo.created_at)
    )
    return [TodoResponse.model_validate(t) for t in result.scalars().all()]


@router.post("", response_model=TodoResponse, status_code=201)
async def create_todo(data: TodoCreate, db: AsyncSession = Depends(get_db)):
    todo = UserTodo(id=str(uuid4()), **data.model_dump())
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return TodoResponse.model_validate(todo)


@router.patch("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: str, data: TodoUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(UserTodo).where(UserTodo.id == todo_id))
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo nicht gefunden")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(todo, key, value)
    await db.commit()
    await db.refresh(todo)
    return TodoResponse.model_validate(todo)


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(todo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserTodo).where(UserTodo.id == todo_id))
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo nicht gefunden")
    await db.delete(todo)
    await db.commit()
