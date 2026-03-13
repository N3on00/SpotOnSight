from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from models.schemas import SupportTicketPublic, SupportTicketRequest
from core.social import as_text, to_support_ticket_public

from .base_service import SocialServiceBase


class SupportService(SocialServiceBase):
    def create_support_ticket(self, req: SupportTicketRequest, current_user: dict[str, Any]) -> SupportTicketPublic:
        me_id = self.me_id(current_user)
        contact_email = as_text(req.contact_email or current_user.get("email"))
        if contact_email and "@" not in contact_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid contact email format")
        now = datetime.now(UTC)
        doc = {
            "user_id": me_id,
            "category": req.category,
            "subject": as_text(req.subject),
            "message": as_text(req.message),
            "page": as_text(req.page),
            "contact_email": contact_email,
            "allow_contact": bool(req.allow_contact),
            "status": "open",
            "created_at": now,
            "updated_at": now,
        }
        inserted_id = self.repos.support_tickets.insert_one(doc)
        row = self.repos.support_tickets.find_one({"_id": ObjectId(inserted_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Support ticket creation failed")
        return to_support_ticket_public(row)

    def list_all_support_tickets(self) -> list[SupportTicketPublic]:
        cursor = self.repos.support_tickets.collection.find().sort("created_at", -1)
        return [to_support_ticket_public(doc) for doc in cursor]

    def update_ticket_status(self, ticket_id: str, ticket_status: str) -> SupportTicketPublic:
        if ticket_status not in ("open", "closed"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'open' or 'closed'")
        if not ObjectId.is_valid(ticket_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ticket ID")
        self.repos.support_tickets.update_fields({"_id": ObjectId(ticket_id)}, {"status": ticket_status, "updated_at": datetime.now(UTC)})
        row = self.repos.support_tickets.find_one({"_id": ObjectId(ticket_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
        return to_support_ticket_public(row)

    def delete_ticket(self, ticket_id: str) -> dict[str, bool]:
        if not ObjectId.is_valid(ticket_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ticket ID")
        result = self.repos.support_tickets.collection.delete_one({"_id": ObjectId(ticket_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
        return {"ok": True, "deleted": True}
