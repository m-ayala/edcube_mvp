"""Authentication and request-identity regression tests."""
import importlib

from fastapi.routing import APIRoute

import routes.teachers as T
from tests.conftest import H

ICC = "a@icc.org"


def test_no_token_is_401_on_protected_routes(w):
    w.anon()
    assert w.c.get("/api/my-courses").status_code == 401
    assert w.c.post("/api/course-builder/plan-day", json={}).status_code == 401
    assert w.c.post("/api/generate-resource", json={}).status_code == 401
    assert w.c.get("/api/account/me").status_code == 401


def test_invalid_token_is_401(w):
    w.who("u1", ICC)
    assert w.c.get("/api/my-courses", headers={"Authorization": "Bearer bad"}).status_code == 401


def test_uid_mismatch_is_403_everywhere_a_client_names_a_teacher(w):
    w.who("u1", ICC)
    get, post = w.c.get, w.c.post
    assert get("/api/my-courses?teacherUid=other", headers=H).status_code == 403
    assert get("/api/section/c/s?teacherUid=other", headers=H).status_code == 403
    assert post("/api/upload-course-file?teacherUid=other", headers=H, files={"file": ("a.xlsx", b"x")}).status_code == 403
    body = {"level": "sections", "context": {"course": {"title": "x"}}, "teacher_uid": "other"}
    assert post("/api/curriculum/generate", headers=H, json=body).status_code == 403
    blocks = {"presetCourseId": "p", "teacherUid": "other", "organizationId": "icc", "courseName": "x",
              "ageRangeStart": 5, "ageRangeEnd": 7, "numStudents": 5, "numDays": 1, "hoursPerDay": 1, "outline": {}, "selections": []}
    assert post("/api/generate-blocks", headers=H, json=blocks).status_code == 403
    # a client-sent organization id that is not the caller's own org is refused as well
    assert post("/api/generate-blocks", headers=H, json={**blocks, "teacherUid": "u1", "organizationId": "zzz"}).status_code == 403


def test_unverified_email_is_403(w):
    w.who("u1", ICC, verified=False)
    r = w.c.get("/api/my-courses", headers=H)
    assert r.status_code == 403 and "verify your email" in r.json()["detail"].lower()
    w.who("u1", ICC)
    w.claims.pop("email_verified")                       # claim missing entirely counts as unverified
    assert w.c.get("/api/my-courses", headers=H).status_code == 403


def test_account_outside_every_org_and_not_bootstrapped_is_403(w):
    w.who("u1", "a@nowhere.com")
    assert w.c.get("/api/my-courses", headers=H).status_code == 403


def test_matching_uid_passes_authentication(w):
    w.who("u1", ICC)
    r = w.c.get("/api/my-courses?teacherUid=u1", headers=H)
    assert r.status_code not in (401, 403)


CORE = ["curriculum", "resources", "topics", "teachers", "notifications", "knowledge_base", "course_builder",
        "file_upload", "uploads", "account", "admin"]


def test_every_route_in_the_core_routers_requires_authentication():
    """Census: a new route added without an auth dependency fails this test.
    Deliberately public (not in CORE): contact, orgs/check-email, waitlist, share/{token}, invites/{token}.
    The camp/after-school synopsis routers use their own ICC gate and are out of scope here."""
    def authed(dep):
        if dep.call in (T.require_org, T.verify_firebase_token, T.require_workspace, T.require_admin):
            return True
        return any(authed(d) for d in dep.dependencies)

    open_routes = []
    for m in CORE:
        for r in importlib.import_module("routes." + m).router.routes:
            if isinstance(r, APIRoute) and not authed(r.dependant):
                open_routes.append((m, sorted(r.methods), r.path))
    assert open_routes == []
