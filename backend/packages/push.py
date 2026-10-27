"""
Expo push delivery.

Expo's push service takes the token the device reports and does the
Apple/Google side for us, so this is a plain HTTPS POST rather than FCM and
APNs clients. https://docs.expo.dev/push-notifications/sending-notifications/
"""
import logging

import requests

from .models import PushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
TIMEOUT_SECONDS = 10


def send_to_user(user, title: str, body: str, data: dict | None = None) -> None:
    """
    Push to every device registered for this user.

    Delivery is best-effort on purpose: a check-in must still succeed if
    Expo is unreachable or the phone has uninstalled the app. Failures are
    logged, never raised to the caller.
    """
    tokens = list(PushToken.objects.filter(user=user).values_list('token', flat=True))
    if not tokens:
        return

    messages = [
        {'to': token, 'sound': 'default', 'title': title, 'body': body, 'data': data or {}}
        for token in tokens
    ]

    try:
        response = requests.post(EXPO_PUSH_URL, json=messages, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        _drop_dead_tokens(response.json(), tokens)
    except requests.RequestException:
        logger.exception('Push send failed for user=%s', user.email)


def _drop_dead_tokens(payload: dict, tokens: list[str]) -> None:
    """
    Expo reports DeviceNotRegistered for uninstalled or reset devices. Those
    tokens never come back, so they're removed rather than retried forever.
    """
    receipts = payload.get('data') or []
    dead = [
        token
        for token, receipt in zip(tokens, receipts)
        if isinstance(receipt, dict)
        and receipt.get('status') == 'error'
        and (receipt.get('details') or {}).get('error') == 'DeviceNotRegistered'
    ]
    if dead:
        PushToken.objects.filter(token__in=dead).delete()
        logger.info('Removed %d unregistered push tokens', len(dead))
