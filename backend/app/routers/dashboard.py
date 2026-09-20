from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database.session import get_db
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_admin)])


@router.get("", response_model=DashboardResponse)
def read_dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    return get_dashboard(db)
