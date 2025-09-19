from flask import Blueprint, request, jsonify
from models import db, JournalEntry, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.sentiment import analyze_text
from datetime import datetime, timedelta
import logging
from utils.events import publish

journal_bp = Blueprint("journal", __name__)
logger = logging.getLogger(__name__)

@journal_bp.route("/entry", methods=["POST"])
@jwt_required()
def add_entry():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        text = data.get("text", "").strip()
        mood_rating = data.get("mood_rating")
        tags = data.get("tags", [])
        
        if not text:
            return jsonify({"error": "Journal text is required"}), 400
        
        if len(text) > 10000:  # Limit text length
            return jsonify({"error": "Journal text too long (max 10,000 characters)"}), 400
        
        # Validate mood rating
        if mood_rating is not None and (not isinstance(mood_rating, int) or mood_rating < 1 or mood_rating > 10):
            return jsonify({"error": "Mood rating must be between 1 and 10"}), 400
        
        user_id = int(get_jwt_identity())
        
        # Analyze sentiment using trained model
        try:
            sentiment, score = analyze_text(text)
        except Exception as e:
            logger.error(f"Sentiment analysis failed: {str(e)}")
            sentiment, score = "NEUTRAL", 0.5
        
        # Create journal entry
        new_entry = JournalEntry(
            user_id=user_id,
            text=text,
            sentiment=sentiment,
            score=score,
            mood_rating=mood_rating,
            tags=",".join(tags) if tags else None
        )
        
        db.session.add(new_entry)
        db.session.commit()
        
        logger.info(f"New journal entry added by user {user_id}")
        # Publish SSE event for real-time updates
        try:
            publish('journal_created', {
                'user_id': user_id,
                'entry': new_entry.to_dict()
            })
        except Exception as pub_err:
            logger.warning(f"Failed to publish SSE event: {pub_err}")
        
        return jsonify({
            "message": "Journal entry added successfully",
            "entry": new_entry.to_dict(),
            "sentiment_analysis": {
                "sentiment": sentiment,
                "confidence_score": score
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Add entry error: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@journal_bp.route("/preview", methods=["POST"])
@jwt_required()
def preview_entry():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        text = data.get("text", "").strip()
        
        if not text:
            return jsonify({"error": "Journal text is required"}), 400
        
        if len(text) > 10000:  # Limit text length
            return jsonify({"error": "Journal text too long (max 10,000 characters)"}), 400
        
        # Analyze sentiment using trained model
        try:
            sentiment, score = analyze_text(text)
        except Exception as e:
            logger.error(f"Sentiment analysis failed: {str(e)}")
            sentiment, score = "NEUTRAL", 0.5
        
        return jsonify({
            "message": "Sentiment analysis completed successfully",
            "sentiment_analysis": {
                "sentiment": sentiment,
                "confidence_score": score
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Preview entry error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@journal_bp.route("/entries", methods=["GET"])
@jwt_required()
def get_entries():
    try:
        user_id = int(get_jwt_identity())
        
        # Query parameters
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 100)  # Max 100 per page
        sentiment_filter = request.args.get("sentiment")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        
        # Build query
        query = JournalEntry.query.filter_by(user_id=user_id)
        
        if sentiment_filter:
            query = query.filter_by(sentiment=sentiment_filter.upper())
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                query = query.filter(JournalEntry.timestamp >= start_dt)
            except ValueError:
                return jsonify({"error": "Invalid start_date format. Use ISO format (YYYY-MM-DD)"}), 400
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                query = query.filter(JournalEntry.timestamp <= end_dt)
            except ValueError:
                return jsonify({"error": "Invalid end_date format. Use ISO format (YYYY-MM-DD)"}), 400
        
        # Order by timestamp (newest first)
        query = query.order_by(JournalEntry.timestamp.desc())
        
        # Pagination
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        entries = [entry.to_dict() for entry in pagination.items]
        
        return jsonify({
            "message": "Entries retrieved successfully",
            "entries": entries,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get entries error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@journal_bp.route("/entry/<int:entry_id>", methods=["GET"])
@jwt_required()
def get_entry(entry_id):
    try:
        user_id = int(get_jwt_identity())
        entry = JournalEntry.query.filter_by(id=entry_id, user_id=user_id).first()
        
        if not entry:
            return jsonify({"error": "Entry not found"}), 404
        
        return jsonify({
            "message": "Entry retrieved successfully",
            "entry": entry.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Get entry error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@journal_bp.route("/entry/<int:entry_id>", methods=["PUT"])
@jwt_required()
def update_entry(entry_id):
    try:
        user_id = int(get_jwt_identity())
        entry = JournalEntry.query.filter_by(id=entry_id, user_id=user_id).first()
        
        if not entry:
            return jsonify({"error": "Entry not found"}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Update fields
        if "text" in data:
            text = data["text"].strip()
            if not text:
                return jsonify({"error": "Journal text cannot be empty"}), 400
            if len(text) > 10000:
                return jsonify({"error": "Journal text too long (max 10,000 characters)"}), 400
            
            entry.text = text
            # Re-analyze sentiment
            try:
                sentiment, score = analyze_text(text)
                entry.sentiment = sentiment
                entry.score = score
            except Exception as e:
                logger.error(f"Sentiment analysis failed: {str(e)}")
        
        if "mood_rating" in data:
            mood_rating = data["mood_rating"]
            if mood_rating is not None and (not isinstance(mood_rating, int) or mood_rating < 1 or mood_rating > 10):
                return jsonify({"error": "Mood rating must be between 1 and 10"}), 400
            entry.mood_rating = mood_rating
        
        if "tags" in data:
            tags = data["tags"]
            if isinstance(tags, list):
                entry.tags = ",".join(tags) if tags else None
        
        entry.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Journal entry {entry_id} updated by user {user_id}")
        
        return jsonify({
            "message": "Entry updated successfully",
            "entry": entry.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Update entry error: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@journal_bp.route("/entry/<int:entry_id>", methods=["DELETE"])
@jwt_required()
def delete_entry(entry_id):
    try:
        user_id = get_jwt_identity()
        entry = JournalEntry.query.filter_by(id=entry_id, user_id=user_id).first()
        
        if not entry:
            return jsonify({"error": "Entry not found"}), 404
        
        db.session.delete(entry)
        db.session.commit()
        
        logger.info(f"Journal entry {entry_id} deleted by user {user_id}")
        
        return jsonify({"message": "Entry deleted successfully"}), 200
        
    except Exception as e:
        logger.error(f"Delete entry error: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@journal_bp.route("/search", methods=["GET"])
@jwt_required()
def search_entries():
    try:
        user_id = get_jwt_identity()
        query_text = request.args.get("q", "").strip()
        
        if not query_text:
            return jsonify({"error": "Search query is required"}), 400
        
        # Search in text content
        entries = JournalEntry.query.filter(
            JournalEntry.user_id == user_id,
            JournalEntry.text.ilike(f"%{query_text}%")
        ).order_by(JournalEntry.timestamp.desc()).limit(50).all()
        
        results = [entry.to_dict() for entry in entries]
        
        return jsonify({
            "message": "Search completed successfully",
            "query": query_text,
            "results": results,
            "count": len(results)
        }), 200
        
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
