from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.team import Team, TeamMember
from app.schemas.team import (
    TeamCreate,
    TeamMemberAdd,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdate,
)

router = APIRouter(prefix="/api", tags=["teams"])


@router.get("/teams", response_model=list[TeamResponse])
async def list_teams(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).order_by(Team.created_at.desc()))
    teams = result.scalars().all()

    responses = []
    for team in teams:
        count_result = await db.execute(
            select(func.count(TeamMember.member_id)).where(
                TeamMember.team_id == team.id
            )
        )
        count = count_result.scalar() or 0
        resp = TeamResponse.model_validate(team)
        resp.member_count = count
        responses.append(resp)
    return responses


@router.post("/teams", response_model=TeamResponse, status_code=201)
async def create_team(data: TeamCreate, db: AsyncSession = Depends(get_db)):
    team = Team(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)
    resp = TeamResponse.model_validate(team)
    resp.member_count = 0
    return resp


@router.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(team_id: str, db: AsyncSession = Depends(get_db)):
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team nicht gefunden")
    count_result = await db.execute(
        select(func.count(TeamMember.member_id)).where(
            TeamMember.team_id == team_id
        )
    )
    resp = TeamResponse.model_validate(team)
    resp.member_count = count_result.scalar() or 0
    return resp


@router.patch("/teams/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str, data: TeamUpdate, db: AsyncSession = Depends(get_db)
):
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team nicht gefunden")

    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(team, key, value)

    await db.commit()
    await db.refresh(team)
    count_result = await db.execute(
        select(func.count(TeamMember.member_id)).where(
            TeamMember.team_id == team_id
        )
    )
    resp = TeamResponse.model_validate(team)
    resp.member_count = count_result.scalar() or 0
    return resp


@router.delete("/teams/{team_id}", status_code=204)
async def delete_team(team_id: str, db: AsyncSession = Depends(get_db)):
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team nicht gefunden")

    # Delete members first
    members_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id)
    )
    for m in members_result.scalars().all():
        await db.delete(m)

    await db.delete(team)
    await db.commit()


@router.get("/teams/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_members(team_id: str, db: AsyncSession = Depends(get_db)):
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team nicht gefunden")

    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at)
    )
    return result.scalars().all()


@router.post(
    "/teams/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=201,
)
async def add_member(
    team_id: str,
    data: TeamMemberAdd,
    db: AsyncSession = Depends(get_db),
):
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team nicht gefunden")

    # Check for duplicate
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.member_id == data.member_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(422, "Mitglied bereits im Team")

    member = TeamMember(
        team_id=team_id,
        member_type=data.member_type,
        member_id=data.member_id,
        role=data.role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/teams/{team_id}/members/{member_id}", status_code=204)
async def remove_member(
    team_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.member_id == member_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Mitglied nicht gefunden")

    await db.delete(member)
    await db.commit()
