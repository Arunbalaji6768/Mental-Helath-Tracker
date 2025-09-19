from flask import Blueprint, Response, stream_with_context, request
from flask_cors import cross_origin
from flask_jwt_extended import verify_jwt_in_request
from utils.events import subscribe, unsubscribe
import time

events_bp = Blueprint("events", __name__)

@events_bp.route('/stream')
@cross_origin()  # Allow CORS for SSE
def stream():
    # Support JWT via query param to work with EventSource
    # Example: /events/stream?token=JWT_TOKEN
    verify_jwt_in_request(optional=False, locations=["query_string"])  # requires ?token=

    q = subscribe()

    def event_stream():
        try:
            # Send a comment to keep connection alive right away
            yield ": connected\n\n"
            while True:
                try:
                    payload = q.get(timeout=30)
                    yield f"data: {payload}\n\n"
                except Exception:
                    # Heartbeat when idle
                    yield ": heartbeat\n\n"
        finally:
            unsubscribe(q)

    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'  # Disable buffering on some proxies
    }

    return Response(stream_with_context(event_stream()), headers=headers)
