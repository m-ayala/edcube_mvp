"""Third access level ("comment"): view + comment, never edit; and the course comments routes."""
import services.sharing_service as SS
from tests.fakes import FakeDB


def _shared_course(w):
    w.mkuser("own", name="Olive Owner")
    w.mkuser("ed", name="Edie Editor")
    w.mkuser("com", name="Cora Commenter")
    w.mkuser("vw", name="Vic Viewer")
    w.mkuser("out", name="Otto Outsider")
    w.mkcourse("c1", "own", courseName="Fractions", organizationId="personal",
               sharedWith=[{"uid": "ed", "accessType": "collaborate"},
                           {"uid": "com", "accessType": "comment"},
                           {"uid": "vw", "accessType": "view"}],
               sharedWithUids=["com", "ed", "vw"])


def test_access_route_reports_the_comment_role(w):
    _shared_course(w)
    a = w.req("com", "get", "/api/curricula/c1/access").json()
    assert a["role"] == "comment" and a["can_edit"] is False and a["can_comment"] is True
    v = w.req("vw", "get", "/api/curricula/c1/access").json()
    assert v["role"] == "view" and v["can_comment"] is False
    o = w.req("own", "get", "/api/curricula/c1/access").json()
    assert o["can_comment"] is True


def test_commenter_and_editor_can_comment_viewer_and_outsider_cannot(w):
    _shared_course(w)
    r = w.req("com", "post", "/api/curricula/c1/comments", json={"text": "  Add a warm-up on day 2.  "})
    assert r.status_code == 200, r.text
    c = r.json()["comment"]
    assert c["text"] == "Add a warm-up on day 2." and c["author_name"] == "Cora Commenter"
    assert c["author_role"] == "comment" and c["can_delete"] is True
    assert w.req("ed", "post", "/api/curricula/c1/comments", json={"text": "Agreed"}).status_code == 200

    v = w.req("vw", "post", "/api/curricula/c1/comments", json={"text": "hi"})
    assert v.status_code == 403 and v.json()["detail"]["code"] == "comments_not_allowed"
    assert w.req("vw", "get", "/api/curricula/c1/comments").status_code == 403
    assert w.req("out", "get", "/api/curricula/c1/comments").status_code == 404

    lst = w.req("own", "get", "/api/curricula/c1/comments").json()["comments"]
    assert [x["text"] for x in lst] == ["Add a warm-up on day 2.", "Agreed"]
    assert all(x["can_delete"] for x in lst)                       # the owner may delete any comment


def test_comment_validation(w):
    _shared_course(w)
    assert w.req("com", "post", "/api/curricula/c1/comments", json={"text": "   "}).json()["detail"]["code"] == "comment_empty"
    long = "x" * (SS.COMMENT_MAX_CHARS + 1)
    assert w.req("com", "post", "/api/curricula/c1/comments", json={"text": long}).json()["detail"]["code"] == "comment_too_long"


def test_only_author_or_owner_deletes_a_comment(w):
    _shared_course(w)
    cid = w.req("com", "post", "/api/curricula/c1/comments", json={"text": "mine"}).json()["comment"]["id"]
    assert w.req("ed", "delete", f"/api/curricula/c1/comments/{cid}").status_code == 403
    seen_by_ed = w.req("ed", "get", "/api/curricula/c1/comments").json()["comments"][0]
    assert seen_by_ed["can_delete"] is False
    assert w.req("com", "delete", f"/api/curricula/c1/comments/{cid}").status_code == 200
    assert w.req("com", "delete", f"/api/curricula/c1/comments/{cid}").status_code == 404
    cid2 = w.req("ed", "post", "/api/curricula/c1/comments", json={"text": "x"}).json()["comment"]["id"]
    assert w.req("own", "delete", f"/api/curricula/c1/comments/{cid2}").status_code == 200


def test_commenter_cannot_save_the_course(w):
    _shared_course(w)
    r = w.UC("com", "c1", courseName="Hacked")
    assert r.status_code == 403
    assert w.course("c1")["courseName"] == "Fractions"


def test_comment_invite_and_accept_never_downgrades_an_editor(w):
    _shared_course(w)
    from datetime import datetime, timezone
    inv = {"workspace": "personal", "course_id": "c1", "owner_uid": "own", "email": "ed@gmail.com",
           "access_type": "comment", "status": SS.PENDING, "token": "t" * 43,
           "expires_at": datetime(2999, 1, 1, tzinfo=timezone.utc)}
    db = FakeDB()
    SS.invites_col(db).document("i1").set(inv)
    SS.accept_invite(db, "i1", inv, "ed", "ed@gmail.com")
    assert SS.entry_for(SS.load_course(db, "personal", "c1"), "ed")["accessType"] == "collaborate"


def test_invite_by_email_accepts_comment(w):
    _shared_course(w)
    r = w.req("own", "post", "/api/curricula/c1/invites", json={"email": "newbie@gmail.com", "access_type": "comment"})
    assert r.status_code == 200, r.text
    assert r.json()["access_type"] == "comment" and r.json()["status"] == "invited"
    bad = w.req("own", "post", "/api/curricula/c1/invites", json={"email": "newbie2@gmail.com", "access_type": "admin"})
    assert bad.status_code == 400
