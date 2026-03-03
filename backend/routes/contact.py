# backend/routes/contact.py
"""
API route for landing page demo requests.
Stores lead in Firestore and emails manaswini.ayala@gmail.com.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime, timezone
import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import firebase_admin
from firebase_admin import firestore

logger = logging.getLogger(__name__)

router = APIRouter()

NOTIFY_TO   = "manaswini.ayala@gmail.com"
GMAIL_USER  = os.getenv("GMAIL_USER", "")
GMAIL_PASS  = os.getenv("GMAIL_APP_PASSWORD", "")


class ContactSubmission(BaseModel):
    name: str
    email: str
    org: Optional[str] = ""
    message: Optional[str] = ""
    type: Literal["demo"]


def _send_email(submission: ContactSubmission):
    if not GMAIL_USER or not GMAIL_PASS:
        logger.warning("GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email")
        return

    subject = f"EdCube demo request from {submission.name}"
    body = (
        f"Name:         {submission.name}\n"
        f"Email:        {submission.email}\n"
        f"Organization: {submission.org or '—'}\n\n"
        f"Message:\n{submission.message or '—'}"
    )

    msg = MIMEMultipart()
    msg["From"]    = GMAIL_USER
    msg["To"]      = NOTIFY_TO
    msg["Subject"] = subject
    msg["Reply-To"] = submission.email
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_PASS)
        server.sendmail(GMAIL_USER, NOTIFY_TO, msg.as_string())


@router.post("/contact")
async def submit_contact(submission: ContactSubmission):
    # Save to Firestore
    try:
        db = firestore.client()
        db.collection("leads").add({
            "name":         submission.name,
            "email":        submission.email,
            "org":          submission.org or "",
            "message":      submission.message or "",
            "type":         submission.type,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error(f"Firestore write failed: {e}")

    # Send notification email
    try:
        _send_email(submission)
        logger.info(f"Demo request email sent for {submission.email}")
    except Exception as e:
        logger.error(f"Email send failed: {e}")

    return {"success": True}
