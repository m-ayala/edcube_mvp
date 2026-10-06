# backend/routes/contact.py
"""
API route for landing page demo requests.
Emails manaswini.ayala@gmail.com. Does not write to Firestore --
the `leads` collection was dropped in the EdCube/Users reorg
(tasks/firestore-reorg-spec.md, decision 5); it was unread and is deleted in
TASK-010.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal, Optional
import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

router = APIRouter()

NOTIFY_TO   = "manaswini@indiacc.org"
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
    # Send notification email
    try:
        _send_email(submission)
        logger.info(f"Demo request email sent for {submission.email}")
    except Exception as e:
        logger.error(f"Email send failed: {e}")

    return {"success": True}
