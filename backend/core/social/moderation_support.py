from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from .ids import as_text, safe_user_projection, serialize_id, spot_owner_id
from .mappers import to_moderation_report_public, to_moderation_user_summary


class SocialModerationSupport:
    def __init__(self, actions) -> None:
        self.actions = actions

    @property
    def repos(self):
        return self.actions.repos

    def target_content(self, target_type: str, target_id: str) -> tuple[dict[str, Any], str]:
        normalized = as_text(target_type).lower()
        if normalized == 'spot':
            target = self.actions.spot_or_404(target_id)
            return target, spot_owner_id(target)
        if normalized == 'comment':
            target = self.actions.comment_or_404(target_id)
            return target, as_text(target.get('user_id'))
        if normalized == 'meetup':
            target = self.actions.meetup_or_404(target_id)
            return target, as_text(target.get('host_user_id'))
        if normalized == 'meetup_comment':
            if not ObjectId.is_valid(target_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid comment ID')
            target = self.repos.meetup_comments.find_one({'_id': ObjectId(target_id)})
            if not target:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Comment not found')
            return target, as_text(target.get('user_id'))
        if normalized == 'user':
            user_id, target = self.actions.user_or_404(target_id)
            return target, user_id
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unsupported moderation target')

    def notify_user(self, user_id: str, *, title: str, message: str, details: str = '') -> None:
        uid = as_text(user_id)
        if not uid:
            return
        self.repos.moderation_notifications.insert_one(
            {
                'user_id': uid,
                'title': as_text(title),
                'message': as_text(message),
                'details': as_text(details),
                'created_at': self.actions._now(),
            }
        )

    @staticmethod
    def severity_weight(severity: str) -> int:
        normalized = as_text(severity).lower()
        if normalized == 'high':
            return 3
        if normalized == 'medium':
            return 2
        return 1

    def recent_strike_metrics(self, user_id: str) -> tuple[int, int]:
        now = self.actions._now()
        rows = self.repos.moderation_strikes.find_many({'user_id': user_id, 'created_at': {'$gte': now - timedelta(days=30)}})
        total_weight = 0
        count = 0
        for row in rows:
            total_weight += max(0, int(row.get('weight') or 0))
            count += 1
        return total_weight, count

    def user_summary(self, user_id: str) -> dict[str, Any] | None:
        uid = as_text(user_id)
        if not ObjectId.is_valid(uid):
            return None
        user_doc = self.repos.users.find_one({'_id': ObjectId(uid)}, safe_user_projection())
        summary = to_moderation_user_summary(user_doc)
        return summary.model_dump() if summary else None

    def reported_person_id(self, row: dict[str, Any]) -> str:
        target_type = as_text(row.get('target_type')).lower()
        if target_type == 'user':
            return as_text(row.get('target_id'))
        return as_text(row.get('target_owner_user_id'))

    def target_preview(self, row: dict[str, Any]) -> dict[str, Any] | None:
        target_type = as_text(row.get('target_type')).lower()
        target_id = as_text(row.get('target_id'))
        if not target_id:
            return None
        try:
            target, owner_id = self.target_content(target_type, target_id)
        except HTTPException:
            return None

        if target_type == 'spot':
            return {
                'id': target_id,
                'label': as_text(target.get('title')) or 'Untitled spot',
                'subtitle': as_text(target.get('tags', [])[0]) if isinstance(target.get('tags'), list) and target.get('tags') else 'Spot',
                'body': as_text(target.get('description')),
                'owner_user_id': owner_id,
                'spot_id': target_id,
                'lat': target.get('lat'),
                'lon': target.get('lon'),
                'moderation_status': as_text(target.get('moderation_status') or 'visible'),
            }
        if target_type == 'comment':
            return {
                'id': target_id,
                'label': 'Spot comment',
                'subtitle': f"On spot {as_text(target.get('spot_id'))}" if as_text(target.get('spot_id')) else 'Comment',
                'body': as_text(target.get('message')),
                'owner_user_id': owner_id,
                'spot_id': as_text(target.get('spot_id')),
                'moderation_status': as_text(target.get('moderation_status') or 'visible'),
            }
        if target_type == 'meetup':
            return {
                'id': target_id,
                'label': as_text(target.get('title')) or 'Untitled meetup',
                'subtitle': 'Meetup',
                'body': as_text(target.get('description')),
                'owner_user_id': owner_id,
                'moderation_status': as_text(target.get('moderation_status') or 'visible'),
            }
        if target_type == 'meetup_comment':
            return {
                'id': target_id,
                'label': 'Meetup comment',
                'subtitle': f"On meetup {as_text(target.get('meetup_id'))}" if as_text(target.get('meetup_id')) else 'Comment',
                'body': as_text(target.get('message')),
                'owner_user_id': owner_id,
                'moderation_status': as_text(target.get('moderation_status') or 'visible'),
            }
        if target_type == 'user':
            return {
                'id': target_id,
                'label': as_text(target.get('display_name') or target.get('username')) or 'User',
                'subtitle': f"@{as_text(target.get('username'))}" if as_text(target.get('username')) else 'User account',
                'body': as_text(target.get('bio')),
                'owner_user_id': owner_id,
            }
        return None

    def moderation_report_metrics(self, row: dict[str, Any]) -> tuple[int, int, int]:
        target_person_id = self.reported_person_id(row)
        reporter_id = as_text(row.get('reporter_user_id'))

        target_distinct_reporters = 0
        target_report_count = 0
        if target_person_id:
          related = self.repos.moderation_reports.find_many({
              '$or': [
                  {'target_type': 'user', 'target_id': target_person_id},
                  {'target_owner_user_id': target_person_id},
              ]
          })
          target_report_count = len(related)
          target_distinct_reporters = len({as_text(item.get('reporter_user_id')) for item in related if as_text(item.get('reporter_user_id'))})

        reporter_distinct_targets = 0
        if reporter_id:
            related = self.repos.moderation_reports.find_many({'reporter_user_id': reporter_id})
            reporter_distinct_targets = len({self.reported_person_id(item) for item in related if self.reported_person_id(item)})

        return target_distinct_reporters, target_report_count, reporter_distinct_targets

    def moderation_report_public(self, row: dict[str, Any]):
        enriched = dict(row)
        enriched['reporter_user'] = self.user_summary(as_text(row.get('reporter_user_id')))
        enriched['target_owner_user'] = self.user_summary(as_text(row.get('target_owner_user_id')))
        if as_text(row.get('target_type')).lower() == 'user':
            enriched['target_user'] = self.user_summary(as_text(row.get('target_id')))
        else:
            enriched['target_user'] = enriched.get('target_owner_user')
        enriched['target_preview'] = self.target_preview(row)
        (
            enriched['target_distinct_reporter_count'],
            enriched['target_report_count'],
            enriched['reporter_distinct_target_count'],
        ) = self.moderation_report_metrics(row)
        return to_moderation_report_public(enriched)

    def recalculate_posting_timeout(self, user_id: str) -> tuple[datetime | None, str]:
        now = self.actions._now()
        user_doc = self.repos.users.find_one({'_id': ObjectId(user_id)}) or {}
        if as_text(user_doc.get('account_status')).lower() == 'banned':
            return None, as_text(user_doc.get('account_status_reason'))
        windows = [
            (7, 3, timedelta(hours=24), 'Posting is paused for 24 hours after repeated recent strikes.'),
            (14, 5, timedelta(days=7), 'Posting is paused for 7 days due to repeated violations.'),
            (30, 7, timedelta(days=30), 'Posting is paused for 30 days and your account now requires manual review.'),
        ]
        timeout_until = None
        message = ''
        for days, threshold, duration, detail in windows:
            rows = self.repos.moderation_strikes.find_many({'user_id': user_id, 'created_at': {'$gte': now - timedelta(days=days)}})
            total_weight = sum(max(0, int(row.get('weight') or 0)) for row in rows)
            if total_weight >= threshold:
                candidate = now + duration
                if timeout_until is None or candidate > timeout_until:
                    timeout_until = candidate
                    message = detail
        self.repos.users.update_fields(
            {'_id': ObjectId(user_id)},
            {
                'posting_timeout_until': timeout_until,
                'account_status': 'watch' if timeout_until else 'active',
                'account_status_reason': message if timeout_until else as_text(''),
            },
        )
        return timeout_until, message

    def apply_strike(self, *, user_id: str, target_type: str, target_id: str, report_id: str, reason: str, severity: str, reviewed_by: str) -> tuple[int, datetime | None, str]:
        weight = self.severity_weight(severity)
        self.repos.moderation_strikes.insert_one(
            {
                'user_id': user_id,
                'target_type': as_text(target_type),
                'target_id': as_text(target_id),
                'report_id': as_text(report_id),
                'reason': as_text(reason),
                'severity': as_text(severity),
                'weight': weight,
                'reviewed_by': as_text(reviewed_by),
                'created_at': self.actions._now(),
            }
        )
        timeout_until, timeout_message = self.recalculate_posting_timeout(user_id)
        return weight, timeout_until, timeout_message
