from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _now():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_now, nullable=False)

    watchlist = db.relationship(
        "WatchlistItem", backref="user", cascade="all, delete-orphan", lazy="dynamic"
    )


class WatchlistItem(db.Model):
    __tablename__ = "watchlist_items"
    __table_args__ = (db.UniqueConstraint("user_id", "norad_id", name="uq_user_sat"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    norad_id = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    added_at = db.Column(db.DateTime(timezone=True), default=_now, nullable=False)

    def to_dict(self):
        return {"norad_id": self.norad_id, "name": self.name}
