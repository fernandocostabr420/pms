from fastapi import APIRouter, Depends, HTTPException
from app.integrations.wubook.sync_service import WuBookSyncService
from app.api.deps import get_current_active_user

router = APIRouter()

@router.get("/sync/rooms")
async def sync_rooms(current_user = Depends(get_current_active_user)):
    """Sincronizar quartos do WuBook"""
    try:
        service = WuBookSyncService()
        rooms = service.sync_rooms()
        return {"status": "success", "count": len(rooms), "rooms": rooms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
