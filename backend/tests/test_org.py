"""Org workspaces: ICC defaults, pooled credits, org-course ownership (TASK-041)."""
import types

import pytest

import routes.topics as TP
from tests.conftest import D, H, HP, STORE


def test_icc_member_defaults_to_the_org_workspace_with_an_unlimited_pool(w):
    w.who("o1", "o1@icc.org")
    j = w.c.post("/api/account/bootstrap", headers=H).json()
    assert j["space"] == "org" and j["org_id"] == "icc" and j["plan"] == "org"
    assert [m["workspace"] for m in j["memberships"]] == ["personal", "icc"]
    # the personal workspace of an org member is a free teacher plan (org staff)
    assert STORE["Accounts/o1"]["plan"] == "teacher" and STORE["Accounts/o1"]["plan_source"] == "org_member"
    me = w.c.get("/api/account/me", headers=H).json()                       # no workspace header -> stays in the org
    assert me["workspace"] == "icc" and me["plan"] == "org"
    assert me["entitlements"]["org_library"] is True and me["entitlements"]["collaborator_cap"] is None
    # ...and the pool is unlimited (limit null) but still counted
    codes = [w.c.post("/api/_t/courses", headers=H).status_code for _ in range(30)]
    ov = w.c.get("/api/account/usage", headers=H).json()
    assert set(codes) == {200} and ov["pool"] is True
    assert ov["credits"]["courses"]["limit"] is None and ov["credits"]["courses"]["remaining"] is None
    assert ov["credits"]["courses"]["used"] == 30


def test_icc_member_can_switch_to_their_personal_workspace(w):
    w.who("o1", "o1@icc.org")
    w.c.post("/api/account/bootstrap", headers=H)
    me = w.c.get("/api/account/me", headers=HP).json()
    assert me["workspace"] == "personal" and me["plan"] == "teacher" and me["home_org"] == "icc"
    assert w.c.get("/api/account/usage", headers=HP).json()["limits"]["generates"] == 150


def test_workspace_header_for_a_workspace_you_are_not_in_is_refused(w):
    w.mkuser("p1")
    w.who("p1", "p1@gmail.com", org="personal")
    r = w.c.get("/api/account/me", headers={**H, "X-EdCube-Workspace": "icc"})
    assert r.status_code == 403


def test_org_pool_is_shared_by_members_and_separate_from_personal_credits(w):
    STORE["Users/acme"] = {"name": "Acme", "domains": ["acme.org"], "allowed_emails": [], "plan": "org",
                           "pool": {"courses": 2, "generates": 3, "edo_messages": 4}, "plan_started_at": D(2026, 1, 31)}
    w.acct("m1", "teacher", orgs=("acme",))
    w.acct("m2", "teacher", orgs=("acme",))
    w.who("m1", "m1@acme.org")
    r1 = w.c.post("/api/_t/courses", headers=H)
    w.who("m2", "m2@acme.org")
    r2 = w.c.post("/api/_t/courses", headers=H)
    r3 = w.c.post("/api/_t/courses", headers=H)
    assert (r1.status_code, r2.status_code, r3.status_code) == (200, 200, 402)
    d = r3.json()["detail"]
    assert d["pool"] is True and d["limit"] == 2 and d["workspace"] == "acme"
    w.who("m1", "m1@acme.org")
    assert w.c.post("/api/_t/courses", headers=H).status_code == 402          # the same pool blocks m1 too
    pool = STORE["Users/acme/usage/_pool/periods/2026-09-30"]                  # anchored on the org's start date
    assert pool["used"]["courses"] == 2 and pool["by_user"] == {"m1": {"courses": 1}, "m2": {"courses": 1}}
    assert not [k for k in STORE if "/usage/m1/" in k or "/usage/m2/" in k]   # nothing drawn from personal plans
    # the same person in their personal workspace pays from the personal plan
    w.who("m1", "m1@acme.org", org="acme")
    assert w.c.post("/api/_t/courses", headers=HP).status_code == 200
    assert w.used("personal", "m1", "2026-10-19", "courses") == 1


# ---- TASK-041: an org member cannot touch another member's course ----------------------------
@pytest.fixture
def icc(w, monkeypatch):
    for u in ("o1", "o2", "o3", "o4"):
        w.mkuser(u, plan=None, email=f"{u}@icc.org")
        STORE[f"Users/icc/teacher_profiles/{u}"] = {"display_name": u}
    w.mkcourse("pub", "o1", ws="icc", courseName="Public", isPublic=True)
    w.mkcourse("priv", "o1", ws="icc", courseName="Private")
    w.course("pub", "icc")["sharedWith"] = [{"uid": "o3", "accessType": "collaborate"}, {"uid": "o4", "accessType": "view"}]
    w.course("pub", "icc")["sharedWithUids"] = ["o3", "o4"]

    async def fake_pop(section, grade_level, teacher_comments=""):
        return {**section, "video_resources": []}
    monkeypatch.setattr(TP.orchestrator, "populate_single_section", fake_pop)
    w.populate = lambda u, cid="pub": w.req(u, "post", "/api/populate-section", json={
        "curriculum_id": cid, "section_id": "s1", "section": {"id": "s1", "title": "T"}, "grade_level": "5"})
    return w


def test_041_org_member_cannot_delete_or_overwrite_another_members_course(icc):
    w = icc
    r = w.req("o2", "delete", "/api/curricula/pub")                           # a published course, same org
    assert r.status_code == 403 and r.json()["detail"]["code"] == "owner_only" and "Users/icc/curricula/pub" in STORE
    r = w.UC("o2", "pub", courseName="overwritten")
    assert r.status_code == 404 and w.course("pub", "icc")["courseName"] == "Public"
    assert w.req("o3", "delete", "/api/curricula/pub").status_code == 403    # a collaborator can't delete either


def test_041_section_writes_follow_access_not_org_membership(icc):
    w = icc
    assert w.populate("o2").status_code == 403                                # org member without access
    assert w.course("pub", "icc")["outline"]["sections"][0].get("video_resources") is None
    assert w.populate("o4").status_code == 403                                # view-only collaborator
    r = w.populate("o3")                                                      # collaborate
    assert r.status_code == 200 and '"done": true' in r.text
    assert w.course("pub", "icc")["outline"]["sections"][0].get("video_resources") == []
    assert w.populate("o1").status_code == 200                                # owner


def test_041_owner_can_delete_and_the_org_library_is_unchanged(icc):
    w = icc
    assert w.req("o2", "get", "/api/curricula/pub").status_code == 200       # published course is visible to members
    assert w.req("o2", "get", "/api/curricula/priv").status_code == 404      # unpublished stays private
    r = w.req("o2", "get", "/api/teachers/")
    assert r.status_code == 200 and isinstance(r.json(), list)
    assert w.req("o1", "delete", "/api/curricula/pub?teacherUid=o1").status_code == 200
    assert "Users/icc/curricula/pub" not in STORE
    assert w.req("o1", "delete", "/api/curricula/nope").status_code == 404
