from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import Config
from models import db
from flask_jwt_extended import JWTManager
from routes.auth import auth_bp, bcrypt
from routes.journal import journal_bp
from routes.analytics import analytics_bp
from routes.events import events_bp
import logging
import os
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend. In production, read allowed origins from env CORS_ORIGINS (comma-separated).
default_origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://mental-helath-tracker.vercel.app",
]

origins = [
    "https://mental-helath-tracker.vercel.app",
    "https://mental-helath-tracker-7o9ktr75o-arunbalajis-projects.vercel.app"
]

CORS(
    app,
    resources={r"/*": {"origins": origins}},
    supports_credentials=False,
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Type", "Authorization"]
)

# Rate limiting (disabled for local expo/demo to avoid 429 during rapid tests)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[]  # no global limits in demo
)

# Skip limiting for CORS preflight and local dev
@limiter.request_filter
def skip_preflight_and_local():
    try:
        if request.method == 'OPTIONS':
            return True
        # Allow localhost traffic freely during demo
        return request.remote_addr in ("127.0.0.1", "::1")
    except Exception:
        return False

bcrypt.init_app(app)
db.init_app(app)
jwt = JWTManager(app)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix="/auth")
app.register_blueprint(journal_bp, url_prefix="/journal")
app.register_blueprint(analytics_bp, url_prefix="/analytics")
app.register_blueprint(events_bp, url_prefix="/events")

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'Mental Health Tracker API',
        'version': '1.0.0'
    })

# Root endpoint
@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'message': 'Mental Health Tracker API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/health',
            'auth': '/auth/*',
            'journal': '/journal/*',
            'analytics': '/analytics/*'
        },
        'documentation': 'Use /health to check API status'
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f'Internal server error: {error}')
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429

# Request logging middleware
@app.before_request
def log_request():
    logger.info(f'{request.method} {request.path} - {request.remote_addr}')

# Initialize database
with app.app_context():
    try:
        db.create_all()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

if __name__ == "__main__":
    logger.info("Starting Mental Health Tracker API...")
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, host='0.0.0.0', port=port)
