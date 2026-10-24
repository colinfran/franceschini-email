# UseSend Python SDK

A minimal Python SDK for the [UseSend](https://usesend.com) API, mirroring the structure of the JavaScript SDK.

## Installation

Install via pip or Poetry:

```
pip install usesend
# or
poetry add usesend
```

## Usage

```python
from usesend import UseSend, types

# By default: raises UseSendHTTPError on non-2xx.
client = UseSend("us_123")

# 1) TypedDict payload (autocomplete in IDEs). Use dict to pass 'from'.
payload: types.EmailCreate = {
    "to": "test@example.com",
    "from": "no-reply@example.com",
    "subject": "Hello",
    "html": "<strong>Hi!</strong>",
}
resp, _ = client.emails.send(payload=payload)

# 2) Or pass a plain dict (supports 'from')
resp, _ = client.emails.send(payload={
    "to": "test@example.com",
    "from": "no-reply@example.com",
    "subject": "Hello",
    "html": "<strong>Hi!</strong>",
})

# Idempotent retries: same payload + same key returns the original response
resp, _ = client.emails.send(
    payload=payload,
    options={"idempotency_key": "signup-123"},
)

# Works for batch requests as well
resp, _ = client.emails.batch(
    payload=[payload],
    options={"idempotency_key": "bulk-welcome-1"},
)
# If the same key is reused with a different payload, the API responds with HTTP 409.

# Toggle behavior if desired:
# - raise_on_error=False: return (None, error_dict) instead of raising
# No model parsing occurs; methods return plain dicts following the typed shapes.
client = UseSend("us_123", raise_on_error=False)
raw, err = client.emails.get(email_id="email_123")
if err:
    print("error:", err)
else:
    print("ok:", raw)
```

## Webhook Local Example

For a runnable webhook verification demo project, see:

- `example/webhook-test-project/README.md`

## Development

This package is managed with Poetry. Models are maintained in-repo under
`usesend/types.py` (readable names). Update this file as the API evolves.

It is published as `usesend` on PyPI.

## Available Resources

- **Emails**: `client.emails.send()`, `client.emails.get()`
- **Domains**: `client.domains.create()`, `client.domains.get()`, `client.domains.verify()`

This installation supports transactional emails only. Contact books, contacts,
campaigns, and their webhook events are not exposed by this client.

Notes

- Human-friendly models are available under `usesend.types` (e.g., `EmailCreate`, `Domain`, `APIError`).
- Endpoint methods accept TypedDict payloads or plain dicts via the `payload=` keyword.
