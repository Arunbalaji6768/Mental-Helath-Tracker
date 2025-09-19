from flask import Blueprint, jsonify, request
from models import JournalEntry, User, db
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import logging

analytics_bp = Blueprint("analytics", __name__)
logger = logging.getLogger(__name__)

@analytics_bp.route("/overview", methods=["GET"])
@jwt_required()
def overview():
    try:
        user_id = get_jwt_identity()
        
        # Get recent entries for overview
        recent_entries = JournalEntry.query.filter_by(user_id=user_id).order_by(
            desc(JournalEntry.timestamp)
        ).limit(10).all()
        
        if not recent_entries:
            return jsonify({
                "message": "No journal entries found",
                "overview": {
                    "average_mood": "No data",
                    "current_streak": 0,
                    "ai_analysis": "Start writing journal entries to get AI-powered insights!",
                    "recent_entries": [],
                    "sentiment_summary": {
                        "positive": 0,
                        "negative": 0,
                        "neutral": 0
                    }
                }
            }), 200
        
        # Calculate average mood from recent entries
        mood_entries = [entry for entry in recent_entries if entry.mood_rating is not None]
        avg_mood = sum(entry.mood_rating for entry in mood_entries) / len(mood_entries) if mood_entries else "No mood data"
        
        # Calculate current streak (simplified)
        current_streak = 1
        if len(recent_entries) > 1:
            # Simple streak calculation - consecutive days with entries
            for i in range(1, len(recent_entries)):
                if (recent_entries[i-1].timestamp.date() - recent_entries[i].timestamp.date()).days == 1:
                    current_streak += 1
                else:
                    break
        
        # Sentiment summary
        sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
        for entry in recent_entries:
            if entry.sentiment == "POSITIVE":
                sentiment_counts["positive"] += 1
            elif entry.sentiment == "NEGATIVE":
                sentiment_counts["negative"] += 1
            else:
                sentiment_counts["neutral"] += 1
        
        # Generate AI analysis based on recent entries
        ai_analysis = "Based on your recent entries, "
        if sentiment_counts["positive"] > sentiment_counts["negative"]:
            ai_analysis += "you've been maintaining a positive outlook. Keep up the great work!"
        elif sentiment_counts["negative"] > sentiment_counts["positive"]:
            ai_analysis += "you might be going through a challenging time. Remember that it's okay to seek support."
        else:
            ai_analysis += "your emotional state has been balanced. Continue reflecting and taking care of yourself."
        
        return jsonify({
            "message": "Overview retrieved successfully",
            "overview": {
                "average_mood": round(avg_mood, 1) if isinstance(avg_mood, (int, float)) else avg_mood,
                "current_streak": current_streak,
                "ai_analysis": ai_analysis,
                "recent_entries": [entry.to_dict() for entry in recent_entries[:5]],
                "sentiment_summary": sentiment_counts,
                "total_entries": JournalEntry.query.filter_by(user_id=user_id).count()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Overview error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@analytics_bp.route("/trends", methods=["GET"])
@jwt_required()
def trends():
    try:
        user_id = get_jwt_identity()
        
        # Get time range (default: last 30 days)
        days = request.args.get("days", 30, type=int)
        if days > 365:  # Limit to 1 year
            days = 365
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get sentiment distribution
        sentiment_counts = db.session.query(
            JournalEntry.sentiment,
            func.count(JournalEntry.id).label('count')
        ).filter(
            JournalEntry.user_id == user_id,
            JournalEntry.timestamp >= start_date
        ).group_by(JournalEntry.sentiment).all()
        
        # Get daily sentiment trends
        daily_trends = db.session.query(
            func.date(JournalEntry.timestamp).label('date'),
            func.avg(JournalEntry.score).label('avg_score'),
            func.count(JournalEntry.id).label('entry_count')
        ).filter(
            JournalEntry.user_id == user_id,
            JournalEntry.timestamp >= start_date
        ).group_by(func.date(JournalEntry.timestamp)).order_by(func.date(JournalEntry.timestamp)).all()
        
        # Get mood rating trends
        mood_trends = db.session.query(
            func.date(JournalEntry.timestamp).label('date'),
            func.avg(JournalEntry.mood_rating).label('avg_mood')
        ).filter(
            JournalEntry.user_id == user_id,
            JournalEntry.timestamp >= start_date,
            JournalEntry.mood_rating.isnot(None)
        ).group_by(func.date(JournalEntry.timestamp)).order_by(func.date(JournalEntry.timestamp)).all()
        
        # Get most common tags - simplified for SQLite compatibility
        all_entries = JournalEntry.query.filter(
            JournalEntry.user_id == user_id,
            JournalEntry.timestamp >= start_date,
            JournalEntry.tags.isnot(None)
        ).all()
        
        tag_counts = {}
        for entry in all_entries:
            if entry.tags:
                for tag in entry.tags:
                    tag = tag.strip()
                    if tag:
                        tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        top_tags = [{"tag": tag, "count": count} for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]]
        
        # Format sentiment distribution
        sentiment_dist = {}
        for item in sentiment_counts:
            sentiment_dist[item.sentiment] = item.count
        
        # Format daily trends
        daily_trends_formatted = []
        for item in daily_trends:
            daily_trends_formatted.append({
                "date": item.date.isoformat() if item.date else "",
                "positive": 0,  # Will be calculated based on sentiment
                "negative": 0,
                "neutral": 0
            })
        
        # Format mood trends
        mood_trends_formatted = []
        for item in mood_trends:
            mood_trends_formatted.append({
                "date": item.date.isoformat() if item.date else "",
                "average_mood": float(item.avg_mood) if item.avg_mood else 0
            })
        
        return jsonify({
            "sentiment_distribution": sentiment_dist,
            "daily_sentiment_trends": daily_trends_formatted,
            "mood_rating_trends": mood_trends_formatted,
            "top_tags": top_tags
        }), 200
        
    except Exception as e:
        logger.error(f"Trends error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@analytics_bp.route("/insights", methods=["GET"])
@jwt_required()
def insights():
    try:
        user_id = get_jwt_identity()
        
        # Get overall statistics
        total_entries = JournalEntry.query.filter_by(user_id=user_id).count()
        
        if total_entries == 0:
            return jsonify({
                "message": "No journal entries found",
                "insights": "Start writing journal entries to get personalized insights!"
            }), 200
        
        # Get recent entries for analysis
        recent_entries = JournalEntry.query.filter_by(user_id=user_id).order_by(
            desc(JournalEntry.timestamp)
        ).limit(50).all()
        
        # Calculate insights
        avg_sentiment_score = sum(entry.score for entry in recent_entries) / len(recent_entries)
        
        # Sentiment trend (comparing last 10 vs previous 10 entries)
        if len(recent_entries) >= 20:
            recent_10 = recent_entries[:10]
            previous_10 = recent_entries[10:20]
            
            recent_avg = sum(entry.score for entry in recent_10) / 10
            previous_avg = sum(entry.score for entry in previous_10) / 10
            
            sentiment_trend = "improving" if recent_avg > previous_avg else "declining" if recent_avg < previous_avg else "stable"
            trend_strength = abs(recent_avg - previous_avg)
        else:
            sentiment_trend = "insufficient data"
            trend_strength = 0
        
        # Most active writing times
        hour_counts = {}
        for entry in recent_entries:
            hour = entry.timestamp.hour
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
        
        peak_hour = max(hour_counts.items(), key=lambda x: x[1])[0] if hour_counts else None
        
        # Generate personalized insights
        insights = []
        
        if avg_sentiment_score < 0.4:
            insights.append("Your recent entries show a more negative emotional tone. Consider reaching out to friends or professionals for support.")
        elif avg_sentiment_score > 0.7:
            insights.append("Your recent entries show a positive emotional tone. Great job maintaining a positive mindset!")
        
        if sentiment_trend == "improving":
            insights.append("Your emotional well-being has been improving recently. Keep up the positive practices!")
        elif sentiment_trend == "declining":
            insights.append("Your emotional well-being has been declining. Consider what might be causing this and seek support if needed.")
        
        if peak_hour is not None:
            insights.append(f"You tend to write most actively around {peak_hour}:00. This might be your most reflective time of day.")
        
        if total_entries >= 30:
            insights.append("You've been consistently journaling! Regular reflection is great for mental health awareness.")
        
        # Count sentiment entries
        positive_entries = sum(1 for entry in recent_entries if entry.sentiment == 'POSITIVE')
        negative_entries = sum(1 for entry in recent_entries if entry.sentiment == 'NEGATIVE')
        neutral_entries = sum(1 for entry in recent_entries if entry.sentiment == 'NEUTRAL')
        
        # Calculate average mood
        mood_entries = [entry for entry in recent_entries if entry.mood_rating is not None]
        avg_mood = sum(entry.mood_rating for entry in mood_entries) / len(mood_entries) if mood_entries else 0
        
        return jsonify({
            "overall_stats": {
                "total_entries": total_entries,
                "positive_entries": positive_entries,
                "negative_entries": negative_entries,
                "neutral_entries": neutral_entries,
                "average_mood": round(avg_mood, 1)
            },
            "sentiment_trend": sentiment_trend,
            "peak_writing_times": [f"{peak_hour}:00"] if peak_hour else [],
            "recommendations": insights + [
                "Try to journal at least once every few days for consistent tracking",
                "Include mood ratings with your entries for better insights",
                "Use tags to categorize your entries by topics or emotions",
                "Review your trends monthly to identify patterns"
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"Insights error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@analytics_bp.route("/summary", methods=["GET"])
@jwt_required()
def summary():
    try:
        user_id = get_jwt_identity()
        
        # Get date range
        days = request.args.get("days", 7, type=int)
        if days > 90:  # Limit to 3 months
            days = 90
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get summary statistics
        entries_in_period = JournalEntry.query.filter(
            JournalEntry.user_id == user_id,
            JournalEntry.timestamp >= start_date
        ).all()
        
        if not entries_in_period:
            return jsonify({
                "message": "No entries found in the specified period",
                "period_days": days,
                "summary": "Start journaling to see your summary!"
            }), 200
        
        # Calculate statistics
        total_entries = len(entries_in_period)
        avg_sentiment_score = sum(entry.score for entry in entries_in_period) / total_entries
        
        # Sentiment breakdown
        sentiment_counts = {}
        for entry in entries_in_period:
            sentiment_counts[entry.sentiment] = sentiment_counts.get(entry.sentiment, 0) + 1
        
        # Mood statistics
        mood_entries = [entry for entry in entries_in_period if entry.mood_rating is not None]
        avg_mood = sum(entry.mood_rating for entry in mood_entries) / len(mood_entries) if mood_entries else None
        
        # Writing consistency
        dates_written = set(entry.timestamp.date() for entry in entries_in_period)
        consistency_rate = len(dates_written) / days
        
        return jsonify({
            "message": "Summary generated successfully",
            "period_days": days,
            "summary": {
                "total_entries": total_entries,
                "entries_per_day": round(total_entries / days, 2),
                "consistency_rate": round(consistency_rate * 100, 1),
                "avg_sentiment_score": round(avg_sentiment_score, 3),
                "avg_mood_rating": round(avg_mood, 1) if avg_mood else None,
                "sentiment_breakdown": sentiment_counts,
                "writing_streak": max(
                    (entry.timestamp.date() for entry in sorted(entries_in_period, key=lambda x: x.timestamp)),
                    default=None
                )
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Summary error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@analytics_bp.route("/export", methods=["GET"])
@jwt_required()
def export_data():
    try:
        user_id = get_jwt_identity()
        
        # Get all user entries
        entries = JournalEntry.query.filter_by(user_id=user_id).order_by(
            desc(JournalEntry.timestamp)
        ).all()
        
        if not entries:
            return jsonify({"error": "No entries found to export"}), 404
        
        # Format data for export
        export_data = []
        for entry in entries:
            export_data.append({
                "id": entry.id,
                "text": entry.text,
                "sentiment": entry.sentiment,
                "confidence_score": entry.score,
                "mood_rating": entry.mood_rating,
                "tags": entry.tags if entry.tags else [],
                "created_at": entry.timestamp.isoformat() if entry.timestamp else None,
                "updated_at": entry.updated_at.isoformat() if entry.updated_at else None
            })
        
        return jsonify({
            "message": "Data exported successfully",
            "total_entries": len(export_data),
            "export_date": datetime.utcnow().isoformat(),
            "data": export_data
        }), 200
        
    except Exception as e:
        logger.error(f"Export error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
