import os
class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "supersecretkey"
    # Prefer env DATABASE_URL; otherwise fallback to a local SQLite file for easy expo demos
    _db_url = os.environ.get("DATABASE_URL") or "sqlite:///mht.db"
    # SQLAlchemy 2.x rejects the legacy "postgres://" scheme that some hosts still provide
    if _db_url.startswith("postgres://"):
        _db_url = "postgresql://" + _db_url[len("postgres://"):]
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Mail settings (configure via environment variables)
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")  # e.g., your email address
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")  # e.g., app password
    MAIL_FROM = os.environ.get("MAIL_FROM") or os.environ.get("MAIL_USERNAME")
    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5500/frontend/Mental-Health_frontend%201/pages")
