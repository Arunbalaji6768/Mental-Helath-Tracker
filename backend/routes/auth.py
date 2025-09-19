from flask import Blueprint, request, jsonify, current_app
from models import db, User, UserSession
from sqlalchemy import or_
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
import re
import logging
import smtplib
from email.message import EmailMessage

bcrypt = Bcrypt()
auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"

def validate_username(username):
    """Validate username format"""
    if len(username) < 3 or len(username) > 20:
        return False, "Username must be between 3 and 20 characters"
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return False, "Username can only contain letters, numbers, and underscores"
    return True, "Username is valid"

@auth_bp.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        email = data.get("email", "").strip()
        
        # Validation
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
        
        # Username validation
        is_valid_username, username_msg = validate_username(username)
        if not is_valid_username:
            return jsonify({"error": username_msg}), 400
        
        # Password validation
        is_valid_password, password_msg = validate_password(password)
        if not is_valid_password:
            return jsonify({"error": password_msg}), 400
        
        # Check if user exists
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already exists"}), 409
        
        # Check email if provided
        if email and User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409
        
        # Create user
        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
        new_user = User(
            username=username,
            email=email if email else None,
            password=hashed_password
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Issue token so the client is authenticated immediately after signup
        token = create_access_token(identity=str(new_user.id), expires_delta=timedelta(hours=24))
        logger.info(f"New user registered: {username}")
        
        return jsonify({
            "message": "User created successfully!",
            "user": new_user.to_dict(),
            "token": token
        }), 201
        
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
        
        # Find user by username OR email (allow email-based login)
        user = User.query.filter(
            or_(User.username == username, User.email == username)
        ).first()
        if not user or not bcrypt.check_password_hash(user.password, password):
            return jsonify({"error": "Invalid username or password"}), 401
        
        if not user.is_active:
            return jsonify({"error": "Account is deactivated"}), 403
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create access token
        token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(hours=24)
        )
        
        logger.info(f"User logged in: {username}")
        
        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "message": "Profile retrieved successfully",
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Profile retrieval error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "message": "User profile retrieved successfully",
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Get current user error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    try:
        # In a real app, you might want to blacklist the token
        # For now, we'll just return success
        logger.info(f"User logged out: {get_jwt_identity()}")
        return jsonify({"message": "Logged out successfully"}), 200
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


def _send_email(to_email: str, subject: str, body: str) -> None:
    """Send an email using SMTP settings from config."""
    cfg = current_app.config
    if not (cfg.get('MAIL_USERNAME') and cfg.get('MAIL_PASSWORD') and cfg.get('MAIL_FROM')):
        logger.warning("Mail credentials not configured; skipping actual send")
        return

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = cfg['MAIL_FROM']
    msg['To'] = to_email
    msg.set_content(body)

    with smtplib.SMTP(cfg['MAIL_SERVER'], cfg['MAIL_PORT']) as server:
        if cfg.get('MAIL_USE_TLS'):
            server.starttls()
        server.login(cfg['MAIL_USERNAME'], cfg['MAIL_PASSWORD'])
        server.send_message(msg)


@auth_bp.route("/request-password-reset", methods=["POST"])
def request_password_reset():
    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        if not email:
            return jsonify({"error": "Email is required"}), 400

        user = User.query.filter_by(email=email).first()
        # Always respond success to avoid user enumeration
        # If user exists, send a reset token link
        if user:
            token = create_access_token(identity=str(user.id), expires_delta=timedelta(minutes=30))
            reset_link = f"{current_app.config.get('FRONTEND_BASE_URL')}/reset-password.html?token={token}"
            try:
                _send_email(
                    to_email=email,
                    subject="Reset your Mental Health Monitor password",
                    body=f"Hello {user.username},\n\nClick the link below to reset your password (valid for 30 minutes):\n{reset_link}\n\nIf you did not request this, you can safely ignore this email."
                )
            except Exception as mail_err:
                logger.error(f"Failed to send reset email: {mail_err}")

        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

    except Exception as e:
        logger.error(f"Password reset request error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    try:
        data = request.get_json() or {}
        token = data.get('token')
        new_password = (data.get('password') or '').strip()
        if not token or not new_password:
            return jsonify({"error": "Token and new password are required"}), 400

        # Decode token by calling a protected method indirectly: create a protected endpoint is overkill; we can use app.jwt_manager._decode_jwt
        from flask_jwt_extended import decode_token
        decoded = decode_token(token)
        user_id = int(decoded.get('sub'))
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "Invalid token"}), 400

        # Update password
        hashed = bcrypt.generate_password_hash(new_password).decode('utf-8')
        user.password = hashed
        db.session.commit()

        return jsonify({"message": "Password reset successfully"}), 200

    except Exception as e:
        logger.error(f"Password reset error: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500
