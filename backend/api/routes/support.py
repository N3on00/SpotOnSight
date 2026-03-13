from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from api.crud import AuthenticatedCreateRouter
from models.schemas import SupportTicketPublic, SupportTicketRequest
from core.admin_setup import get_current_admin_user
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.support_service import SupportService


def create_support_router(repos: SocialRepositories) -> APIRouter:
    router = APIRouter()
    service = SupportService(repos)

    router.include_router(
        AuthenticatedCreateRouter(
            model=SupportTicketRequest,
            repository=repos.support_tickets,
            prefix="/support/tickets",
            tags=["Social"],
            auth_dependency=get_current_user,
            create_handler=service.create_support_ticket,
            response_model=SupportTicketPublic,
            status_code=201,
            collection_path="",
        ).build()
    )

    @router.get("/support/tickets/admin/all", response_model=list[SupportTicketPublic])
    def list_all_support_tickets(_admin_user: dict = Depends(get_current_admin_user)):
        return service.list_all_support_tickets()

    @router.patch("/support/tickets/{ticket_id}/status", response_model=SupportTicketPublic)
    def update_ticket_status(
        ticket_id: str,
        ticket_status: str = Query(alias="status"),
        _admin_user: dict = Depends(get_current_admin_user),
    ):
        return service.update_ticket_status(ticket_id, ticket_status)

    @router.delete("/support/tickets/{ticket_id}")
    def delete_ticket(ticket_id: str, _admin_user: dict = Depends(get_current_admin_user)):
        return service.delete_ticket(ticket_id)

    return router
