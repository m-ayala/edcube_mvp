"""One clearly named test per outlier case in the Phase 8 spec (test_outlier_01 ... test_outlier_14).

These run the real routes against the in-memory Firestore from tests/fakes.py.

Out of scope for pytest: the *frontend* half of outlier 6 (an open editor keeps the user's unsaved
draft in localStorage and switches to a locked state when the server refuses a write). That lives in
frontend/src and was verified in a browser/e2e harness during TASK-037; the backend half (the next
write after a downgrade is refused with a clear code) is tested here.
"""
import json
import types
from datetime import datetime, timedelta, timezone

import pytest

import services.accounts_service as A
import services.usage_service as US
from tests import fakes
from tests.conftest import D, H, HP, STORE

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


@pytest.fixture
def team(w):
    """A paid owner 'own' with two collaborators on course k, and one of them also on k2."""
    w.mkuser("own", name="Olive Owner")
    w.mkuser("col", name="Cole")
    w.mkuser("col2")
    w.mkcourse("k", "own", courseName="K")
    w.mkcourse("k2", "own", courseName="K2")
    for cid, who in (("k", "col@gmail.com"), ("k2", "col@gmail.com"), ("k", "col2@gmail.com")):
        assert w.invite("own", cid, who).json()["status"] == "added"
    return w


# 1 ---------------------------------------------------------------------------------------------
def test_outlier_01_presser_pays_with_their_own_credits(team):
    w = team
    assert w.req("col", "post", "/api/_t/generates").status_code == 200
    assert any(k.startswith("Users/personal/usage/col/") for k in STORE)
    # the course owner's counters were never touched, even though it is the owner's course
    assert not any(k.startswith("Users/personal/usage/own/") for k in STORE)


# 2 ---------------------------------------------------------------------------------------------
def test_outlier_02_collaborator_without_credits_keeps_editing_ai_gets_upgrade_402(team):
    w = team
    # (a) trial expired
    STORE["Accounts/col"].update(plan="trial", trial_ends_at=NOW() - timedelta(days=2))
    A.clear_cache()
    r = w.UC("col", "k", objectives="manual edit, expired trial")
    assert r.status_code == 200 and w.course("k")["objectives"] == "manual edit, expired trial"
    r = w.req("col", "post", "/api/_t/generates")
    assert r.status_code == 402 and r.json()["detail"]["code"] == "plan_inactive"
    assert "waitlist" in r.json()["detail"]["message"].lower()      # upgrade message, no price

    # (b) trial running but this one credit kind is at zero: only that AI feature pauses, editing continues
    STORE["Accounts/col"].update(plan="trial", trial_ends_at=NOW() + timedelta(days=10))
    A.clear_cache()
    for _ in range(60):
        try:
            US.confirm(US.reserve("personal", "col", "generates"))
        except US.QuotaExceeded:
            break
    r = w.req("col", "post", "/api/_t/generates")
    assert r.status_code == 402 and r.json()["detail"]["code"] == "quota_exceeded"
    assert w.req("col", "post", "/api/_t/edo_messages").status_code == 200       # other counters still work
    r = w.UC("col", "k", objectives="still editing at zero credits")
    assert r.status_code == 200 and w.course("k")["objectives"] == "still editing at zero credits"


# 3 ---------------------------------------------------------------------------------------------
def test_outlier_03_owner_plan_lapses_collaborators_go_view_only(team):
    w = team
    assert w.invite("own", "k", "ghost@gmail.com").json()["status"] == "invited"      # a pending invite
    before = json.dumps(w.course("k"), default=str)
    assert w.admin_plan("own", "trial").status_code == 200

    # pending invites cancelled immediately, with a reason
    assert not w.invites("pending")
    assert w.invites("cancelled")[0]["cancel_reason"] == "owner_plan_no_coediting"
    # every collaborator is view-only now
    for who in ("col", "col2"):
        r = w.UC(who, "k", objectives="after lapse")
        assert r.status_code == 403 and r.json()["detail"]["code"] == "coediting_not_in_plan"
    assert w.course("k").get("objectives") != "after lapse"
    r = w.req("col", "get", "/api/curricula/k")
    assert r.status_code == 200 and r.json()["access"]["can_edit"] is False        # can still read
    # nothing deleted: collaborators are still listed, the course is intact
    assert {s["uid"] for s in w.course("k")["sharedWith"]} == {"col", "col2"}
    assert json.loads(before)["courseName"] == w.course("k")["courseName"]
    # the owner keeps editing
    r = w.UC("own", "k", objectives="owner keeps editing")
    assert r.status_code == 200 and w.course("k")["objectives"] == "owner keeps editing"
    # no new collaborate invites while lapsed
    assert w.invite("own", "k", "new2@gmail.com").status_code == 402


# 4 ---------------------------------------------------------------------------------------------
def test_outlier_04_resubscribe_restores_collaborator_edit(team):
    w = team
    w.admin_plan("own", "trial")
    assert w.UC("col", "k", objectives="x").status_code == 403
    w.admin_plan("own", "teacher")
    r = w.UC("col", "k", objectives="back again")
    assert r.status_code == 200 and w.course("k")["objectives"] == "back again"
    r = w.UC("col2", "k", objectives="col2 too")
    assert r.status_code == 200
    # sharedWith was never touched, so nothing needed re-granting
    assert {s["uid"] for s in w.course("k")["sharedWith"]} == {"col", "col2"}


# 5 ---------------------------------------------------------------------------------------------
def test_outlier_05_collaborators_own_trial_expiring_does_not_cost_edit_access(team):
    w = team
    assert w.UC("col", "k", objectives="while trial running").status_code == 200
    STORE["Accounts/col"].update(plan="trial", trial_ends_at=NOW() - timedelta(days=1))   # their trial ends
    A.clear_cache()
    r = w.UC("col", "k", objectives="after my trial ended")
    assert r.status_code == 200 and w.course("k")["objectives"] == "after my trial ended"
    r = w.req("col", "get", "/api/curricula/k")
    assert r.json()["access"] == {"role": "collaborate", "can_edit": True, "reason": None}


# 6 ---------------------------------------------------------------------------------------------
def test_outlier_06_plan_change_applies_to_the_very_next_write(team):
    """Backend half only; the frontend draft-keeping behaviour is covered by the TASK-037 e2e harness."""
    w = team
    assert w.UC("col", "k", objectives="v1").status_code == 200
    w.admin_plan("own", "trial")                       # downgrade while col has the course open
    r = w.UC("col", "k", objectives="v2")              # col's very next autosave
    d = r.json()["detail"]
    assert r.status_code == 403 and d["code"] == "coediting_not_in_plan" and d["message"]
    assert w.course("k")["objectives"] == "v1"        # refused, nothing half-applied
    r = w.req("col", "get", "/api/curricula/k/access")  # what the editor's poll sees
    assert r.status_code == 200 and r.json()["role"] == "collaborate" and r.json()["can_edit"] is False
    # section-level AI/write route is gated by the same decision, before any AI work happens
    r = w.req("col", "post", "/api/populate-section",
              json={"curriculum_id": "k", "section_id": "s1", "section": {"id": "s1", "title": "T"}, "grade_level": "5"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "coediting_not_in_plan"
    # and upgrading takes effect just as immediately
    w.admin_plan("own", "teacher")
    assert w.UC("col", "k", objectives="v3").status_code == 200


# 7 ---------------------------------------------------------------------------------------------
def test_outlier_07_removed_or_leaving_collaborator_loses_access_immediately(team):
    w = team
    assert w.req("col", "get", "/api/curricula/k").status_code == 200
    # removed by the owner
    assert w.req("own", "delete", "/api/curricula/k/collaborators/col").status_code == 200
    assert {s["uid"] for s in w.course("k")["sharedWith"]} == {"col2"}
    assert w.course("k")["sharedWithUids"] == ["col2"]            # both fields in the same write
    assert w.req("col", "get", "/api/curricula/k").status_code == 404          # next read
    r = w.UC("col", "k", objectives="still here?")                              # next write
    assert r.status_code == 404 and w.course("k").get("objectives") != "still here?"
    # the removed user is told through the existing inbox
    assert any(v["toUid"] == "col" and v["type"] == "course_share_remove"
               for k, v in STORE.items() if k.startswith("Users/personal/notifications/"))
    # leaving
    assert w.req("col2", "post", "/api/curricula/k/leave").status_code == 200
    assert w.course("k")["sharedWith"] == [] and w.course("k")["sharedWithUids"] == []
    assert w.req("col2", "get", "/api/curricula/k").status_code == 404
    assert w.UC("col2", "k", objectives="z").status_code == 404
    # the other course of "col" was not affected by removal from k
    assert w.req("col", "get", "/api/curricula/k2").status_code == 200


# 8 ---------------------------------------------------------------------------------------------
def test_outlier_08_collaborator_contributions_belong_to_the_owner(team):
    w = team
    assert w.UC("col", "k", objectives="written by col", courseName="Renamed by col").status_code == 200
    c = w.course("k")
    assert c["objectives"] == "written by col"
    assert c["teacherUid"] == "own"                                           # owner unchanged
    # no per-collaborator ownership/authorship fields appeared anywhere on the course doc
    extra = [k for k in c if "owner" in k.lower() and k != "teacherUid"]
    assert extra == []
    assert not [k for k in c if k.lower() in ("lasteditedby", "updatedby", "authoruid", "collaboratoruid", "editorid")]
    assert all(set(s) == {"uid", "accessType"} for s in c["sharedWith"])
    # the collaborator can't take over by sending ownership fields either
    w.UC("col", "k", teacherUid="col")
    assert w.course("k")["teacherUid"] == "own"


# 9 ---------------------------------------------------------------------------------------------
def test_outlier_09_owner_deletes_course(w):
    w.mkuser("own"); w.mkuser("col"); w.mkuser("v")
    w.mkcourse("d", "own", courseName="D")
    w.invite("own", "d", "col@gmail.com"); w.invite("own", "d", "v@gmail.com", "view")
    w.invite("own", "d", "p1@gmail.com"); w.invite("own", "d", "p2@gmail.com", "view")
    l1 = w.req("own", "post", "/api/curricula/d/links").json()["token"]
    l2 = w.req("own", "post", "/api/curricula/d/links").json()["token"]
    w.req("own", "delete", f"/api/curricula/d/links/{l2}")                        # one revoked, one active
    # impact counts are right BEFORE the delete
    r = w.req("own", "get", "/api/curricula/d/delete-impact").json()
    assert (r["collaborators"], r["pending_invites"], r["active_links"]) == (2, 2, 1)
    assert w.req("col", "get", "/api/curricula/d/delete-impact").status_code == 403    # owner-only
    # collaborators cannot delete
    r = w.req("col", "delete", "/api/curricula/d?teacherUid=col")
    assert r.status_code == 403 and r.json()["detail"]["code"] == "owner_only" and "Users/personal/curricula/d" in STORE
    # the owner can
    r = w.req("own", "delete", "/api/curricula/d?teacherUid=own")
    assert r.status_code == 200 and r.json()["impact"]["collaborators"] == 2
    assert w.req("col", "get", "/api/curricula/d").status_code == 404            # collaborators lose access
    w.anon()
    assert w.c.get(f"/api/share/{l1}").status_code == 404                          # links stop
    assert not w.invites("pending")                                                 # pending invites cancelled
    assert len(w.invites("cancelled")) == 2 and all(v["cancel_reason"] == "course_deleted" for v in w.invites("cancelled"))
    assert w.req("own", "get", "/api/curricula/d/delete-impact").status_code == 404


# 10 --------------------------------------------------------------------------------------------
def test_outlier_10_fourth_collaborator_blocked_counting_pending_invites(w):
    w.mkuser("own")
    for u in ("a1", "a2", "a3", "a4"):
        w.mkuser(u)
    w.mkcourse("c4", "own", courseName="Cap")
    w.invite("own", "c4", "a1@gmail.com"); w.invite("own", "c4", "a2@gmail.com")
    r = w.invite("own", "c4", "ghost@gmail.com")                                   # a pending invite, not yet a user
    assert r.status_code == 200 and r.json()["collaborators"] == 2 and r.json()["pending_collaborate_invites"] == 1
    r = w.invite("own", "c4", "a3@gmail.com")                                       # would be the 4th
    d = r.json()["detail"]
    assert r.status_code == 402 and d["code"] == "plan_upgrade_required" and d["reason"] == "collaborator_cap_reached"
    assert d["cap"] == 3 and d["current"] == 3
    assert "a3" not in w.course("c4")["sharedWithUids"]
    # a brand-new email is blocked too, and creates nothing
    r = w.invite("own", "c4", "another@gmail.com")
    assert r.status_code == 402 and len(w.invites("pending")) == 1
    # view access doesn't use a slot; re-sending the existing pending invite is fine
    assert w.invite("own", "c4", "a3@gmail.com", "view").status_code == 200
    assert w.invite("own", "c4", "ghost@gmail.com").json()["resent"] is True
    # cancelling the pending invite frees the slot
    pid = [k.split("/")[1] for k, v in STORE.items() if k.startswith("Invites/") and v["status"] == "pending"][0]
    assert w.req("own", "delete", f"/api/curricula/c4/invites/{pid}").status_code == 200
    assert w.invite("own", "c4", "a3@gmail.com").json()["status"] == "added"


# 11 --------------------------------------------------------------------------------------------
def test_outlier_11_one_user_can_collaborate_on_many_courses(w):
    w.mkuser("col")
    owners = ["o%d" % i for i in range(5)]
    for i, o in enumerate(owners):
        w.mkuser(o)
        w.mkcourse("c%d" % i, o)
        assert w.invite(o, "c%d" % i, "col@gmail.com").json()["status"] == "added"
    r = w.req("col", "get", "/api/curricula/shared-with-me")
    assert r.status_code == 200 and sorted(x["id"] for x in r.json()["courses"]) == ["c%d" % i for i in range(5)]
    for i in range(5):                                                            # and edits each of them
        assert w.UC("col", "c%d" % i, objectives="by col").status_code == 200


# 12 --------------------------------------------------------------------------------------------
def test_outlier_12_failed_generation_is_never_charged(w, gen_mode, openai_stub):
    w.acct("f1", "trial", D(2026, 10, 19), D(2026, 11, 18))
    w.who("f1", "f1@gmail.com", org="personal")
    gen_mode["v"] = "502"                                                          # handled upstream failure
    r = w.c.post("/api/_t/generates", headers=H)
    assert r.status_code == 502 and w.used("personal", "f1", "trial", "generates") == 0 and w.held("personal", "f1", "trial") == 0
    gen_mode["v"] = "crash"                                                        # unhandled exception
    r = w.c.post("/api/_t/courses", headers=H)
    assert r.status_code == 500 and w.used("personal", "f1", "trial", "courses") == 0 and w.held("personal", "f1", "trial") == 0
    openai_stub["v"] = "err"                                                       # a real route: Edo with OpenAI down
    r = w.c.post("/api/curriculum/chat", headers=H, json={"message": "hello"})
    assert r.status_code == 500 and w.used("personal", "f1", "trial", "edo_messages") == 0 and w.held("personal", "f1", "trial") == 0
    # while a success IS charged exactly once
    gen_mode["v"] = "ok"
    assert w.c.post("/api/_t/generates", headers=H).status_code == 200
    assert w.used("personal", "f1", "trial", "generates") == 1


# 13 --------------------------------------------------------------------------------------------
@pytest.fixture
def course_gen(w, monkeypatch):
    """Generate Course with the AI phases stubbed; `ph` steers what they 'produce'."""
    import interpreter.requirements_interpreter as RI
    import routes.curriculum as C

    ph = {"outline": {"sections": [{"id": "s1", "title": "Day 1"}]}, "chains": [{"id": "c1", "subsections": []}], "p15": "ok"}
    monkeypatch.setattr(RI, "interpret_requirements", lambda **kw: {"detected_subject": "Sci", "detected_topic": "Plants"})

    async def fake_p1(teacher_input, images=None):
        if ph["outline"] == "raise":
            raise ValueError("No outline generated")
        return ph["outline"]

    async def fake_p15(teacher_input, outline_data):
        if ph["p15"] == "crash":
            yield {"type": "subsections_ready", "section_id": "s1", "chains": ph["chains"], "progress": 55}
            raise RuntimeError("phase 1.5 died")
        for sec in (outline_data or {}).get("sections", []):
            yield {"type": "subsections_ready", "section_id": sec["id"], "chains": ph["chains"], "progress": 60}
        yield {"type": "candidates_complete"}

    monkeypatch.setattr(C.orchestrator, "run_phase1", fake_p1)
    monkeypatch.setattr(C.orchestrator, "run_phase1_5", fake_p15)
    form = {"course_name": "Plants", "age_range_start": 8, "age_range_end": 10, "num_students": 10, "num_days": 2,
            "hours_per_day": 2, "num_worksheets": 1, "num_activities": 1, "organizationId": "personal"}
    events = []
    import logging

    class Cap(logging.Handler):
        def emit(self, r):
            m = r.getMessage()
            if m.startswith("usage_event "):
                events.append(json.loads(m[len("usage_event "):]))

    lg = logging.getLogger("services.usage_service")
    h = Cap()
    lg.addHandler(h)
    monkeypatch.setattr(lg, "level", logging.INFO)
    w.acct("g1", "trial", D(2026, 10, 19), D(2026, 11, 18))
    w.who("g1", "g1@gmail.com", org="personal")

    def gen(flow="legacy"):
        return w.c.post("/api/generate-curriculum", headers=H, data={**form, "flow": flow})

    yield types.SimpleNamespace(ph=ph, gen=gen, events=events)
    lg.removeHandler(h)


def test_outlier_13_partial_generate_course_counts_only_if_usable(w, course_gen):
    used = lambda: w.used("personal", "g1", "trial", "courses")      # noqa: E731
    ph, gen, events = course_gen.ph, course_gen.gen, course_gen.events

    # usable: an outline with a titled section AND candidate subsection chains -> charged
    r = gen()
    assert r.status_code == 200 and "candidates_complete" in r.text and used() == 1
    ev = [e for e in events if e.get("action") == "generate_course"][-1]
    assert ev["usable"] is True and ev["charged"] is True and ev["partial"]["stage"] == "candidates_complete"

    # unusable partials are refunded AND still logged (usable false, charged false, with what was produced)
    ph["outline"] = {"sections": []}
    events.clear()
    gen()
    assert used() == 1 and w.held("personal", "g1", "trial") == 0
    ev = [e for e in events if e.get("action") == "generate_course"][-1]
    assert ev["usable"] is False and ev["charged"] is False and ev["partial"]["outline_sections"] == 0

    ph["outline"] = {"sections": [{"id": "s1", "title": "Day 1"}]}
    ph["p15"] = "crash"                                  # outline fine, subsection phase died part-way
    events.clear()
    r = gen()
    assert used() == 1 and w.held("personal", "g1", "trial") == 0 and "error" in r.text
    ev = [e for e in events if e.get("action") == "generate_course"][-1]
    assert ev["partial"]["stage"] == "subsections" and ev["partial"]["error"] == "RuntimeError" and ev["charged"] is False

    ph["p15"] = "ok"
    ph["outline"] = "raise"                              # nothing produced at all
    gen()
    assert used() == 1
    ph["outline"] = {"sections": [{"id": "s1", "title": "  "}]}   # a blank-titled section is not usable
    gen()
    assert used() == 1


def test_outlier_13b_usability_rule_is_pure_and_course_builder_flow_follows_it(w, course_gen, monkeypatch):
    assert US.outline_is_usable({"sections": [{"title": "x"}]}) and US.outline_is_usable({"days": [{"title": "d"}]})
    assert not US.outline_is_usable({}) and not US.outline_is_usable(None)
    assert not US.outlines_are_usable([]) and US.outlines_are_usable([{"days": []}, {"days": [{"title": "a"}]}])
    import outliner.course_outline_generator as COG
    cb = {"v": [{"days": [{"id": "d1", "title": "Day one"}]}]}

    def fake_outlines(inputs, images=None):
        if cb["v"] == "err":
            raise COG.OutlineGenerationError("bad structure")
        return cb["v"]

    monkeypatch.setattr(COG, "generate_course_outlines", fake_outlines)
    monkeypatch.setattr(COG, "outline_to_legacy", lambda *a, **k: {"sections": []})
    used = lambda: w.used("personal", "g1", "trial", "courses")      # noqa: E731
    assert "outlines_ready" in course_gen.gen("course_builder").text and used() == 1
    for bad in ([], [{"days": []}], "err"):
        cb["v"] = bad
        course_gen.gen("course_builder")
        assert used() == 1 and w.held("personal", "g1", "trial") == 0


# 14 --------------------------------------------------------------------------------------------
def test_outlier_14_simultaneous_ai_actions_cannot_go_below_zero(w):
    w.acct("cc", "trial", D(2026, 10, 19), D(2026, 11, 18))
    STORE["Users/personal/usage/cc/periods/trial"] = {"used": {"courses": 4}, "reservations": {}}   # remaining = 1
    res = {}

    def attempt(name):
        try:
            res[name] = US.reserve("personal", "cc", "courses")
        except US.QuotaExceeded as e:
            res[name] = e

    # B reserves and commits while A sits between its read and its commit: A must conflict, retry, and be refused
    fakes.HOOK["before_commit"] = lambda: attempt("B")
    before = fakes.STATS["attempts"]
    attempt("A")
    winners = [n for n, v in res.items() if isinstance(v, dict)]
    assert winners == ["B"] and isinstance(res["A"], US.QuotaExceeded)
    assert fakes.STATS["attempts"] - before == 3                 # A, B, then A's retry
    assert w.held("personal", "cc", "trial") == 1 and w.used("personal", "cc", "trial", "courses") == 4

    # sanity: without the conflict path the same interleaving would double-spend, so this test is meaningful
    fakes.reset_store()
    from tests.conftest import seed_base
    seed_base()
    w.acct("cc", "trial", D(2026, 10, 19), D(2026, 11, 18))
    STORE["Users/personal/usage/cc/periods/trial"] = {"used": {"courses": 4}, "reservations": {}}
    fakes.CONFLICT["on"] = False
    res.clear()
    fakes.HOOK["before_commit"] = lambda: attempt("B")
    attempt("A")
    assert sum(isinstance(v, dict) for v in res.values()) == 2
