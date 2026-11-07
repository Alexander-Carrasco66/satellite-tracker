import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from models import User, WatchlistItem, db
from satellite_service import SatelliteService

load_dotenv()


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "postgresql://tracker:tracker@localhost:5432/tracker"
    )
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-only-secret-change-me")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 60 * 60 * 24 * 7

    CORS(app, resources={r"/api/*": {"origins": os.environ.get("CORS_ORIGIN", "*")}})
    db.init_app(app)
    JWTManager(app)

    groups = [g.strip() for g in os.environ.get("CELESTRAK_GROUPS", "stations,visual,gps-ops").split(",")]
    sats = SatelliteService(groups)

    with app.app_context():
        db.create_all()

    # ---- Auth ----------------------------------------------------------
    def credentials():
        data = request.get_json(silent=True) or {}
        return (data.get("email") or "").strip().lower(), data.get("password") or ""

    @app.post("/api/auth/register")
    def register():
        email, password = credentials()
        if "@" not in email or len(email) > 255:
            return jsonify(error="Enter a valid email address."), 400
        if len(password) < 8:
            return jsonify(error="Password must be at least 8 characters."), 400
        user = User(email=email, password_hash=generate_password_hash(password))
        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify(error="An account with that email already exists."), 409
        token = create_access_token(identity=str(user.id))
        return jsonify(token=token, email=user.email), 201

    @app.post("/api/auth/login")
    def login():
        email, password = credentials()
        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify(error="Incorrect email or password."), 401
        return jsonify(token=create_access_token(identity=str(user.id)), email=user.email)

    @app.get("/api/auth/me")
    @jwt_required()
    def me():
        user = db.session.get(User, int(get_jwt_identity()))
        if not user:
            return jsonify(error="User not found."), 404
        return jsonify(email=user.email)

    # ---- Satellites ----------------------------------------------------
    @app.get("/api/satellites")
    def satellites():
        data = sats.positions()
        return jsonify(count=len(data), satellites=data)

    @app.get("/api/satellites/<int:norad_id>/track")
    def track(norad_id):
        minutes = min(int(request.args.get("minutes", 95)), 360)
        points = sats.track(norad_id, minutes=minutes)
        if points is None:
            return jsonify(error="Unknown satellite."), 404
        return jsonify(norad_id=norad_id, points=points)

    # ---- Watchlist -----------------------------------------------------
    @app.get("/api/watchlist")
    @jwt_required()
    def get_watchlist():
        uid = int(get_jwt_identity())
        items = WatchlistItem.query.filter_by(user_id=uid).order_by(WatchlistItem.added_at).all()
        return jsonify(watchlist=[i.to_dict() for i in items])

    @app.post("/api/watchlist")
    @jwt_required()
    def add_watchlist():
        uid = int(get_jwt_identity())
        try:
            norad = int((request.get_json(silent=True) or {}).get("norad_id"))
        except (TypeError, ValueError):
            return jsonify(error="norad_id must be an integer."), 400
        entry = sats.catalog().get(norad)
        if not entry:
            return jsonify(error="Unknown satellite."), 404
        item = WatchlistItem(user_id=uid, norad_id=norad, name=entry["name"])
        db.session.add(item)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()  # already on the watchlist: treat as success
            item = WatchlistItem.query.filter_by(user_id=uid, norad_id=norad).first()
        return jsonify(item.to_dict()), 201

    @app.delete("/api/watchlist/<int:norad_id>")
    @jwt_required()
    def remove_watchlist(norad_id):
        uid = int(get_jwt_identity())
        WatchlistItem.query.filter_by(user_id=uid, norad_id=norad_id).delete()
        db.session.commit()
        return "", 204

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
