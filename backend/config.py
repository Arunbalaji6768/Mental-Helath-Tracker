import os
class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "supersecretkey"
    # Prefer env DATABASE_URL; otherwise fallback to a local SQLite file for easy expo demos
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or f"sqlite:///mht.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Mail settings (configure via environment variables)
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")  # e.g., your email address
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")  # e.g., app password
    MAIL_FROM = os.environ.get("MAIL_FROM") or os.environ.get("MAIL_USERNAME")
    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5500/frontend/Mental-Health_frontend%201/pages")
