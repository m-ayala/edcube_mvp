"""Accounts, trial/plan limits from config, credit periods, admin gating."""
from datetime import timedelta

import pytest

import services.accounts_service as A
import services.platform_config as PC
import services.usage_service as US
from tests.conftest import D, H, STORE


# ---- new users and config-driven limits -----------------------------------------------------
def test_new_user_gets_a_trial_whose_length_comes_from_config(w):
    w.who("g1", "g1@gmail.com")
    r = w.c.post("/api/account/bootstrap", headers=H, json={"display_name": "Gina"})
    a = STORE["Accounts/g1"]
    assert r.status_code == 200 and a["plan"] == "trial" and a["plan_source"] == "trial_default"
    assert a["trial_ends_at"] - a["plan_started_at"] == timedelta(days=30)         # default config
    STORE["EdCube/platform_config"] = {"trial_length_days": 7}                     # config doc only, no code change
    PC.clear_cache(); A.clear_cache()
    w.who("g2", "g2@gmail.com")
    w.c.post("/api/account/bootstrap", headers=H)
    assert STORE["Accounts/g2"]["trial_ends_at"] - STORE["Accounts/g2"]["plan_started_at"] == timedelta(days=7)
    before = dict(STORE["Accounts/g2"])                                            # bootstrap is idempotent
    w.c.post("/api/account/bootstrap", headers=H)
    assert STORE["Accounts/g2"]["trial_ends_at"] == before["trial_ends_at"]


def test_plan_limits_are_read_from_config_not_code(w):
    STORE["EdCube/platform_config"] = {"plans": {"trial": {"limits": {"generates": 2, "courses": None}},
                                                  "teacher": {"collaborator_cap": 5}}}
    PC.clear_cache()
    w.mkuser("g2", plan="trial")
    w.who("g2", "g2@gmail.com", org="personal")
    lim = w.c.get("/api/account/usage", headers=H).json()["limits"]
    assert lim["generates"] == 2 and lim["courses"] is None and lim["edo_messages"] == 75     # untouched default kept
    assert PC.collaborator_cap("teacher") == 5 and PC.collaborator_cap("trial") == 0


def test_default_limits_for_each_plan():
    cfg = PC.get_config()["plans"]
    assert cfg["trial"]["limits"] == {"courses": 5, "generates": 50, "edo_messages": 75}
    assert cfg["teacher"]["limits"]["generates"] == 150
    assert cfg["org"]["collaborator_cap"] is None            # org: unlimited by default
    assert PC.collaborator_cap("teacher") == 3 and PC.collaborator_cap("trial") == 0


def test_trial_is_one_time_and_never_resets(w, clock):
    w.acct("t1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("t1", "t1@gmail.com", org="personal")
    codes = [w.c.post("/api/_t/courses", headers=H).status_code for _ in range(6)]
    assert codes == [200] * 5 + [402]
    d = w.c.post("/api/_t/courses", headers=H).json()["detail"]
    assert d["kind"] == "courses" and d["limit"] == 5 and d["remaining"] == 0 and d["resets_at"] is None
    clock.set(D(2026, 11, 10))                                            # a calendar month later, same trial
    assert w.c.post("/api/_t/courses", headers=H).status_code == 402


def test_teacher_credits_reset_on_the_anniversary_with_no_rollover(w, clock):
    STORE["EdCube/platform_config"] = {"plans": {"teacher": {"limits": {"courses": 2, "generates": 2, "edo_messages": 3}}}}
    w.acct("p1", "teacher", D(2026, 1, 15, 9))
    w.who("p1", "p1@gmail.com", org="personal")
    w.c.post("/api/_t/generates", headers=H); w.c.post("/api/_t/generates", headers=H)
    r = w.c.post("/api/_t/generates", headers=H)
    assert r.status_code == 402 and r.json()["detail"]["resets_at"] == "2026-11-15T00:00:00+00:00"
    clock.set(D(2026, 11, 14, 23, 59))
    assert w.c.post("/api/_t/generates", headers=H).status_code == 402
    clock.set(D(2026, 11, 15, 0, 1))                                      # anniversary, not the 1st of the month
    assert w.c.post("/api/_t/generates", headers=H).status_code == 200
    assert w.used("personal", "p1", "2026-11-15", "generates") == 1 and w.used("personal", "p1", "2026-10-15", "generates") == 2
    # unused October courses did not roll over
    assert US.usage_overview("personal", "p1")["credits"]["courses"]["remaining"] == 2


@pytest.mark.parametrize("started, now, period", [
    (D(2026, 1, 31, 15), D(2026, 2, 28, 1), (D(2026, 2, 28), D(2026, 3, 31))),     # 31st clamps to Feb 28
    (D(2026, 1, 31), D(2026, 2, 27, 23), (D(2026, 1, 31), D(2026, 2, 28))),
    (D(2026, 1, 31), D(2026, 3, 30), (D(2026, 2, 28), D(2026, 3, 31))),            # not chained from the clamp
    (D(2026, 1, 31), D(2026, 4, 30, 5), (D(2026, 4, 30), D(2026, 5, 31))),
    (D(2028, 1, 31), D(2028, 2, 29, 2), (D(2028, 2, 29), D(2028, 3, 31))),         # leap year
    (D(2026, 1, 15), D(2026, 12, 20), (D(2026, 12, 15), D(2027, 1, 15))),
    (None, D(2026, 12, 20), (D(2026, 12, 1), D(2027, 1, 1))),                      # no anchor: calendar month
])
def test_anniversary_period_clamps_to_month_end(started, now, period):
    assert US.monthly_period(started, now) == period


def test_calendar_reset_rule_is_config_switchable(w):
    STORE["EdCube/platform_config"] = {"reset_rule": "calendar"}
    w.acct("p2", "teacher", D(2026, 1, 15))
    w.who("p2", "p2@gmail.com", org="personal")
    w.c.post("/api/_t/courses", headers=H)
    assert w.used("personal", "p2", "2026-10-01", "courses") == 1


# ---- Edo is charged per message ---------------------------------------------------------------
def test_edo_is_charged_per_message_not_per_token(w, openai_stub):
    w.acct("t1", "trial", D(2026, 10, 19, 12), D(2026, 11, 18, 12))
    w.who("t1", "t1@gmail.com", org="personal")
    codes = [w.c.post("/api/curriculum/chat", headers=H, json={"message": "hello"}).status_code for _ in range(75)]
    r = w.c.post("/api/curriculum/chat", headers=H, json={"message": "hello"})
    assert codes == [200] * 75 and r.status_code == 402
    assert r.json()["detail"]["kind"] == "edo_messages" and r.json()["detail"]["limit"] == 75
    assert w.used("personal", "t1", "trial", "edo_messages") == 75           # 321 tokens per reply did not matter


# ---- expired trial ----------------------------------------------------------------------------
def test_trial_ended_ai_is_402_plan_inactive_but_manual_editing_works(w, openai_stub):
    w.mkuser("t1", plan="trial")
    STORE["Accounts/t1"]["trial_ends_at"] = D(2020, 1, 1)
    A.clear_cache()
    w.mkcourse("m1", "t1")
    for route in ("/api/_t/generates", "/api/_t/courses", "/api/_t/edo_messages"):
        r = w.req("t1", "post", route)
        d = r.json()["detail"]
        assert r.status_code == 402 and d["code"] == "plan_inactive" and d["reason"] == "trial_ended", route
        assert "waitlist" in d["message"].lower() and "$" not in d["message"]       # no price
    r = w.req("t1", "post", "/api/curriculum/chat", json={"message": "hi"})
    assert r.status_code == 402 and r.json()["detail"]["code"] == "plan_inactive"
    assert openai_stub["calls"] == 0                                                # refused before any AI call
    assert not any(k.startswith("Users/personal/usage/t1") for k in STORE)          # nothing charged
    assert w.UC("t1", "m1", courseName="renamed").status_code == 200                # manual save works
    assert w.req("t1", "get", "/api/curricula/m1").status_code == 200


def test_trial_ended_manual_save_course_works_and_costs_nothing(w, monkeypatch):
    import routes.curriculum as C
    w.mkuser("t1", plan="trial")
    STORE["Accounts/t1"]["trial_ends_at"] = D(2020, 1, 1)
    A.clear_cache()

    async def fake_save(**kw):
        return "newcid"
    monkeypatch.setattr(C.firebase, "save_curriculum", fake_save)
    r = w.req("t1", "post", "/api/save-course?teacherUid=t1", json={"courseName": "Hand made", "sections": []})
    assert r.status_code == 200
    assert not any(k.startswith("Users/personal/usage/t1") for k in STORE)


# ---- admin ------------------------------------------------------------------------------------
ADMIN_CALLS = [
    ("get", "/api/admin/accounts/t1", None),
    ("get", "/api/admin/accounts?email=a@b.c", None),
    ("get", "/api/admin/accounts/recent", None),
    ("patch", "/api/admin/accounts/t1/plan", {"plan": "teacher"}),
    ("post", "/api/admin/accounts/t1/credits", {"courses": 1}),
    ("post", "/api/admin/accounts/t1/deactivate", None),
    ("get", "/api/admin/accounts/t1/usage", None),
    ("get", "/api/admin/domains", None),
]


@pytest.mark.parametrize("method, path, body", ADMIN_CALLS)
def test_admin_routes_are_403_for_non_admins_and_401_without_a_token(w, method, path, body):
    w.mkuser("t1", plan="trial")
    w.mkuser("plain", plan="teacher")
    kw = {"json": body} if body is not None else {}
    assert w.req("plain", method, path, **kw).status_code == 403
    w.anon()
    assert getattr(w.c, method)(path, **kw).status_code == 401
    assert STORE["Accounts/t1"]["plan"] == "trial"                 # and nothing changed


def test_admin_set_plan_grant_credits_and_audit_trail(w):
    w.mkuser("t1", plan="trial")
    STORE["Accounts/t1"]["trial_ends_at"] = D(2020, 1, 1)
    A.clear_cache()
    assert w.req("t1", "post", "/api/_t/generates").status_code == 402
    r = w.admin_plan("t1", "teacher")
    a = STORE["Accounts/t1"]
    assert r.status_code == 200 and a["plan"] == "teacher" and a["plan_source"] == "admin" and a["trial_ends_at"] is None
    assert w.req("t1", "post", "/api/_t/generates").status_code == 200       # AI available again, immediately
    w.who("adm", "adm@gmail.com", admin=True)
    assert w.c.patch("/api/admin/accounts/t1/plan", headers=H, json={"plan": "gold"}).status_code == 400
    r = w.c.post("/api/admin/accounts/t1/credits", headers=H, json={"courses": 2, "edo_messages": 10})
    assert r.status_code == 200 and STORE["Accounts/t1"]["bonus_credits"] == {"courses": 2, "generates": 0, "edo_messages": 10}
    w.c.post("/api/admin/accounts/t1/credits", headers=H, json={"courses": 1})
    assert STORE["Accounts/t1"]["bonus_credits"]["courses"] == 3             # credits accumulate
    audits = [v for k, v in STORE.items() if k.startswith("AdminAudit/")]
    assert sorted(v["action"] for v in audits) == ["grant_credits", "grant_credits", "set_plan"]
    sp = [v for v in audits if v["action"] == "set_plan"][0]
    assert sp["admin_uid"] == "adm" and sp["target_uid"] == "t1" and sp["before"]["plan"] == "trial" and sp["after"]["plan"] == "teacher"
