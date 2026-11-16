
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import date

from flask import Flask, jsonify, render_template, request
from werkzeug.security import check_password_hash

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(BASE_DIR, "data", "registrations.db")
)

# Cancellation password hash is supplied through an environment variable.
CANCEL_PASSWORD_HASH = os.environ.get("CANCEL_PASSWORD_HASH", "")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VALID_YEARS = {1, 2, 3, 4}


# ---------- Database helpers ----------

@contextmanager
def get_db():
    """Open a connection, commit on success, roll back on error."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS registrations (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id  TEXT NOT NULL UNIQUE COLLATE NOCASE,
                full_name   TEXT NOT NULL,
                email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
                department  TEXT NOT NULL,
                year        INTEGER NOT NULL CHECK (year BETWEEN 1 AND 4),
                seminar     TEXT NOT NULL,
                reg_date    TEXT NOT NULL
            )
            """
        )


# ---------- Validation ----------

def validate(data):
    """Validate registration details."""

    fields = [
        "student_id", "full_name", "email",
        "department", "year", "seminar"
    ]

    clean = {
        field: str(data.get(field, "")).strip()
        for field in fields
    }

    missing = [
        field.replace("_", " ")
        for field, value in clean.items()
        if not value
    ]

    if missing:
        return None, f"Please fill in: {', '.join(missing)}."

    if not EMAIL_RE.match(clean["email"]):
        return None, "Please enter a valid email address."

    if len(clean["full_name"]) < 2:
        return None, "Please enter a valid full name."

    try:
        year = int(clean["year"])
    except ValueError:
        return None, "Year must be a number between 1 and 4."

    if year not in VALID_YEARS:
        return None, "Year must be between 1 and 4."

    clean["student_id"] = clean["student_id"].upper()
    clean["email"] = clean["email"].lower()
    clean["year"] = year

    return clean, None


# ---------- Routes ----------

@app.route("/")
def home():
    return render_template("index.html")


# Register participant

@app.route("/api/register", methods=["POST"])
def register():

    data, error = validate(request.get_json(silent=True) or {})

    if error:
        return jsonify({"error": error}), 400

    try:
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO registrations
                    (student_id, full_name, email, department,
                     year, seminar, reg_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    data["student_id"],
                    data["full_name"],
                    data["email"],
                    data["department"],
                    data["year"],
                    data["seminar"],
                    date.today().isoformat()
                )
            )

    except sqlite3.IntegrityError as e:

        if "student_id" in str(e):
            return jsonify({
                "error": "This Student ID is already registered."
            }), 409

        if "email" in str(e):
            return jsonify({
                "error": "This email address is already registered."
            }), 409

        return jsonify({
            "error": "Duplicate registration detected."
        }), 409

    return jsonify({
        "message": "Registration successful!"
    }), 201


# List and search registrations

@app.route("/api/registrations", methods=["GET"])
def list_registrations():

    query = request.args.get("search", "").strip()

    with get_db() as conn:

        if query:
            like = f"%{query}%"

            rows = conn.execute(
                """
                SELECT * FROM registrations
                WHERE student_id LIKE ?
                   OR full_name LIKE ?
                   OR email LIKE ?
                ORDER BY id DESC
                """,
                (like, like, like)
            ).fetchall()

        else:
            rows = conn.execute(
                "SELECT * FROM registrations ORDER BY id DESC"
            ).fetchall()

    return jsonify([dict(row) for row in rows])


# Cancel registration - PASSWORD PROTECTED

@app.route("/api/registrations/<int:reg_id>", methods=["DELETE"])
def cancel_registration(reg_id):

    data = request.get_json(silent=True) or {}
    password = data.get("password", "")

    # Do not allow cancellation if no password hash is configured.
    if not CANCEL_PASSWORD_HASH:
        return jsonify({
            "error": "Cancellation password is not configured on the server."
        }), 503

    if not isinstance(password, str) or not password:
        return jsonify({
            "error": "Cancellation password is required."
        }), 400

    # Verify password on the server.
    if not check_password_hash(CANCEL_PASSWORD_HASH, password):
        return jsonify({
            "error": "Incorrect password. Registration was not cancelled."
        }), 401

    with get_db() as conn:

        cur = conn.execute(
            "DELETE FROM registrations WHERE id = ?",
            (reg_id,)
        )

    if cur.rowcount == 0:
        return jsonify({
            "error": "Registration not found."
        }), 404

    return jsonify({
        "message": "Registration cancelled successfully!"
    }), 200


# Total registrations

@app.route("/api/total", methods=["GET"])
def total():

    with get_db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM registrations"
        ).fetchone()[0]

    return jsonify({"total": count})


# ---------- Error handlers ----------

@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Not found."}), 404


@app.errorhandler(500)
def server_error(_):
    return jsonify({
        "error": "Something went wrong on the server."
    }), 500


init_db()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )
