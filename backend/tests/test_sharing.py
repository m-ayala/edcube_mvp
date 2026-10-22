"""View-only links and invites: sanitised public payload, token handling, email-bound invite acceptance."""
from datetime import timedelta, datetime, timezone

import services.accounts_service as A
import services.sharing_service as SS
from tests.conftest import STORE

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _public_course(w):
    w.mkuser("own", name="Olive Owner")
    w.mkuser("x", name="Xavier")
    w.mkcourse(
        "c1", "own", courseName="Fractions", teacherEmail="own@gmail.com", organizationId="personal",
        courseInfoNotes="private notes",
        outline={"sections": [{"id": "s1", "title": "Day 1", "subsections": [
            {"title": "Intro", "blocks": [{"type": "text", "content": "hello kids", "authorUid": "own",
                                           "contactEmail": "own@gmail.com"}]}]}]},
        sections=[{"id": "s1", "title": "Day 1"}],
        courseAttachments=[{"id": "a1", "filename": "doc.pdf", "fileType": "pdf",
                            "fileUrl": "https://storage.googleapis.com/b/Users/personal/course_attachments/c1/a1/doc.pdf",
                            "extractedText": "SECRET TEXT", "description": "worksheet", "isActive": True}],
        sharedWith=[{"uid": "x", "accessType": "view"}], sharedWithUids=["x"], isPublic=True)
    return w.req("own", "post", "/api/curricula/c1/links").json()["token"]


def test_public_share_view_needs_no_auth_and_leaks_no_emails_uids_or_file_text(w):
    tok = _public_course(w)
    assert len(tok) >= 43                                                  # 256-bit url-safe token
    w.anon()
    r = w.c.get(f"/api/share/{tok}")
    body = r.text
    assert r.status_code == 200 and r.json()["read_only"] is True
    assert r.json()["title"] == "Fractions" and r.json()["owner_display_name"] == "Olive Owner"
    assert "hello kids" in body and "Day 1" in body                         # real content is there
    leaks = ["own@gmail.com", "x@gmail.com", '"own"', '"x"', "sharedWith", "teacherUid", "teacherEmail", "authorUid",
             "contactEmail", "organizationId", "isPublic", "SECRET TEXT", "extractedText", "course_attachments",
             "storage.googleapis", "fileUrl", "private notes"]
    assert [leak for leak in leaks if leak in body] == []
    # attachments are described by name only
    assert r.json()["course"]["courseAttachments"] == [{"filename": "doc.pdf", "fileType": "pdf", "description": "worksheet"}]
    assert "no-store" in r.headers["cache-control"] and "noindex" in r.headers["x-robots-tag"]


def test_uploaded_file_text_appended_to_objectives_never_reaches_a_link(w):
    secret = "UPLOADED FILE SECRET"
    w.mkuser("own", name="Olive Owner")
    w.mkcourse("u1", "own", courseName="Upl", objectives="Teach fractions.\n\nATTACHED MATERIALS:\n\n--- File: a.pdf ---\n" + secret,
               outline={"objectives": "Teach x\nATTACHED MATERIALS:\n" + secret, "interpreted_requirements": {"raw": secret},
                        "requirements": secret,
                        "sections": [{"id": "s1", "title": "T", "notes": "ok\n--- File: b.txt ---\n" + secret}]},
               courseDescription="desc ATTACHED MATERIALS: " + secret, courseInfoNotes=secret)
    tok = w.req("own", "post", "/api/curricula/u1/links").json()["token"]
    w.anon()
    r = w.c.get(f"/api/share/{tok}")
    assert r.status_code == 200
    assert secret not in r.text and "ATTACHED MATERIALS" not in r.text and "--- File" not in r.text
    assert r.json()["course"]["objectives"] == "Teach fractions."          # typed part is kept


def test_revoked_deleted_unknown_and_deactivated_links_all_look_the_same_404(w):
    tok = _public_course(w)
    w.anon()
    unknown = w.c.get("/api/share/" + "z" * 43)
    assert unknown.status_code == 404 and unknown.json()["detail"]["code"] == "link_unavailable"
    assert w.req("own", "delete", f"/api/curricula/c1/links/{tok}").status_code == 200
    w.anon()
    r = w.c.get(f"/api/share/{tok}")
    assert r.status_code == 404 and r.json() == unknown.json()              # revoked: indistinguishable from unknown
    # only the owner manages links
    assert w.req("x", "post", "/api/curricula/c1/links").status_code == 403
    # a deactivated owner's links stop, and come back on reactivation
    tok2 = w.req("own", "post", "/api/curricula/c1/links").json()["token"]
    w.req("own", "post", "/api/account/deactivate")
    w.anon()
    assert w.c.get(f"/api/share/{tok2}").json() == unknown.json()
    w.req("own", "post", "/api/account/reactivate")
    w.anon()
    assert w.c.get(f"/api/share/{tok2}").status_code == 200


def test_public_view_is_rate_limited_per_client_ip(w, monkeypatch):
    tok = _public_course(w)
    monkeypatch.setattr(SS.PUBLIC_VIEW_LIMITER, "limit", 3)
    SS.reset_limiters()
    w.anon()
    codes = [w.c.get(f"/api/share/{tok}").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    r = w.c.get(f"/api/share/{tok}")
    assert "retry-after" in r.headers and r.json()["detail"]["code"] == "rate_limited"


def test_invite_accept_with_a_different_email_is_403_and_changes_nothing(w):
    w.mkuser("own", name="Olive Owner")
    w.mkuser("wrong", email="wrong@gmail.com")
    w.mkcourse("c", "own", courseName="Shared Course")
    j = w.invite("own", "c", "Newbie@Gmail.com").json()
    assert j["status"] == "invited"
    inv = w.invites("pending")[0]
    assert inv["email"] == "newbie@gmail.com"                               # lower-cased
    r = w.req("wrong", "post", f"/api/invites/{inv['token']}/accept")
    d = r.json()["detail"]
    assert r.status_code == 403 and d["code"] == "invite_email_mismatch"
    assert "n***@gmail.com" in d["message"] and "newbie@gmail.com" not in r.text    # hint is masked
    assert "wrong" not in w.course("c")["sharedWithUids"] and w.invites("pending")[0]["status"] == "pending"
    # needs auth, and a verified email
    w.anon()
    assert w.c.post(f"/api/invites/{inv['token']}/accept").status_code == 401
    w.who("newbie", "newbie@gmail.com", verified=False)
    assert w.c.post(f"/api/invites/{inv['token']}/accept", headers={"Authorization": "Bearer ok"}).status_code == 403


def test_invite_accept_by_the_right_account_then_idempotent_then_dead_for_others(w):
    w.mkuser("own", name="Olive Owner")
    w.mkuser("wrong", email="wrong@gmail.com")
    w.mkcourse("c", "own", courseName="Shared Course")
    w.invite("own", "c", "newbie@gmail.com")
    tok = w.invites("pending")[0]["token"]
    w.mkuser("newbie", plan="trial", name="Newbie")                        # signs up free, then accepts
    r = w.req("newbie", "post", f"/api/invites/{tok}/accept")
    assert r.status_code == 200 and r.json()["course_id"] == "c" and r.json()["access_type"] == "collaborate"
    assert {"uid": "newbie", "accessType": "collaborate"} in w.course("c")["sharedWith"] and "newbie" in w.course("c")["sharedWithUids"]
    assert w.req("newbie", "post", f"/api/invites/{tok}/accept").json()["already_accepted"] is True
    assert w.req("wrong", "post", f"/api/invites/{tok}/accept").status_code == 410
    # a free-trial collaborator edits the paid owner's course: the owner's plan governs
    assert w.UC("newbie", "c", objectives="by newbie").status_code == 200


def test_invite_landing_page_is_public_but_reveals_nothing_sensitive(w):
    w.mkuser("own", name="Olive Owner")
    w.mkcourse("c", "own", courseName="Shared Course")
    w.invite("own", "c", "newbie@gmail.com")
    tok = w.invites("pending")[0]["token"]
    w.anon()
    r = w.c.get(f"/api/invites/{tok}")
    assert r.json()["available"] is True and r.json()["course_title"] == "Shared Course" and r.json()["inviter_name"] == "Olive Owner"
    assert "own@gmail.com" not in r.text and "newbie@gmail.com" not in r.text
    assert w.c.get("/api/invites/" + "q" * 43).status_code == 404


def test_expired_invites_are_410(w):
    w.mkuser("own"); w.mkcourse("ce", "own")
    w.invite("own", "ce", "late@gmail.com")             # no account yet -> a pending invite
    w.mkuser("late")
    inv_id = [k for k, v in STORE.items() if k.startswith("Invites/")][0]
    tok = STORE[inv_id]["token"]
    STORE[inv_id]["expires_at"] = NOW() - timedelta(days=1)
    r = w.req("late", "post", f"/api/invites/{tok}/accept")
    assert r.status_code == 410 and r.json()["detail"]["status"] == "expired"
    w.anon()
    assert w.c.get(f"/api/invites/{tok}").json() == {"available": False, "status": "expired"}


def test_invite_email_failure_does_not_fail_the_invite(w):
    w.mkuser("own"); w.mkcourse("c", "own")
    w.mail["fail"] = True
    r = w.invite("own", "c", "mailfail@gmail.com", "view")
    assert r.status_code == 200 and r.json()["email_sent"] is False and r.json()["invite_url"]
    w.mail["fail"] = False
    r = w.invite("own", "c", "ok@gmail.com", "view")
    assert w.sent[-1]["to"] == "ok@gmail.com" and r.json()["invite_url"] in w.sent[-1]["body"]


def test_invites_to_non_org_emails_are_refused_in_an_org_workspace(w):
    w.mkuser("o1", plan=None, email="o1@icc.org"); w.mkcourse("oc", "o1", ws="icc")
    STORE["Users/icc/teacher_profiles/o1"] = {"display_name": "O1"}
    r = w.invite("o1", "oc", "outsider@gmail.com")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "not_in_org"
