"""Shared fixtures for the offline backend test suite.

No network, no real credentials, no live Firestore. Everything that would leave the process is
replaced before the app is imported:

* ``firebase_admin`` firestore client / storage bucket / transactions  -> ``tests/fakes.py``
* ``firebase.project.firestore_client`` and ``firebase_admin.firestore.client`` -> the fake DB
* ``firebase_admin.auth`` (verify_id_token, get_user, claims)         -> controlled by ``World``
* OpenAI and Browserbase                                              -> stub fixtures below
* ``.env`` loading and API-key environment variables                  -> neutralised

Run with:  cd backend && python -m pytest
"""
import asyncio
import inspect
import os
import sys
import types
from datetime import datetime, timedelta, timezone

import pytest

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

# ---- never read a real .env or use a real key -------------------------------------------------
import dotenv  # noqa: E402

dotenv.load_dotenv = lambda *a, **k: False
for _k in ("OPENAI_API_KEY", "YOUTUBE_API_KEY", "GOOGLE_API_KEY", "GOOGLE_CSE_ID", "BROWSERBASE_API_KEY",
           "FRONTEND_URL", "RESOURCE_SEARCH_PROVIDER", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST"):
    os.environ.pop(_k, None)
os.environ["OPENAI_API_KEY"] = "test-key-not-real"

# ---- TestClient / httpx compatibility guard ---------------------------------------------------
import starlette.testclient as _stc  # noqa: E402

if "app" in inspect.signature(__import__("httpx").Client.__init__).parameters:
    pass  # httpx < 0.28: fine for every starlette
elif tuple(int(x) for x in __import__("starlette").__version__.split(".")[:2]) < (0, 37):
    raise RuntimeError(
        "starlette %s (pinned in requirements.txt) needs httpx<0.28 for TestClient, but httpx %s is installed. "
        "Run: pip install -r requirements-dev.txt   (it downgrades httpx to 0.27.x for the test venv)"
        % (__import__("starlette").__version__, __import__("httpx").__version__))

import firebase_admin  # noqa: E402
from firebase_admin import auth, firestore, storage  # noqa: E402

from tests import fakes  # noqa: E402

firebase_admin._apps["x"] = object()          # "already initialised": the app never calls initialize_app
storage.bucket = lambda *a, **k: object()
firestore.client = lambda *a, **k: fakes.DB
firestore.transactional = fakes.transactional
firestore.Increment = fakes.Inc

import firebase.project as _project  # noqa: E402

_project.firestore_client = lambda: fakes.DB

import firebase.org_registry as OR  # noqa: E402

OR._get_db = lambda db=None: fakes.DB

import main  # noqa: E402  (the real FastAPI app)
import firebase.paths as P  # noqa: E402
import services.accounts_service as A  # noqa: E402
import services.platform_config as PC  # noqa: E402
import services.usage_service as US  # noqa: E402
import services.sharing_service as SS  # noqa: E402
import services.cost_tracker as CT  # noqa: E402
import routes.contact as CONTACT  # noqa: E402
import routes.teachers as T  # noqa: E402

# every module that did `from firebase.project import firestore_client` at import time
for _m in list(sys.modules.values()):
    if getattr(_m, "firestore_client", None) is not None and getattr(_m, "__name__", "").split(".")[0] in (
            "routes", "services", "firebase"):
        _m.firestore_client = lambda: fakes.DB

from fastapi import Depends, HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

STORE = fakes.STORE
H = {"Authorization": "Bearer ok"}
HP = {**H, "X-EdCube-Workspace": "personal"}


def D(*a):
    return datetime(*a, tzinfo=timezone.utc)


# ---- probe routes that run the real quota dependency (the way every AI route does) ------------
GEN_MODE = {"v": "ok"}


async def _probe():
    if GEN_MODE["v"] == "502":
        raise HTTPException(status_code=502, detail="openai down")
    if GEN_MODE["v"] == "crash":
        raise RuntimeError("boom")
    return {"ok": True}


for _kind in ("generates", "courses", "edo_messages"):
    main.app.add_api_route("/api/_t/%s" % _kind, _probe, methods=["POST"],
                           dependencies=[Depends(US.enforce_quota(_kind))])
main.app.add_api_route("/api/_t/gen_named", _probe, methods=["POST"],
                       dependencies=[Depends(US.enforce_quota("generates", "t_gen"))])


# ---- the World: users, courses, requests ------------------------------------------------------
class World:
    """Everything a test needs: the client, fake users, helper calls. One instance per test."""

    def __init__(self, client, clock):
        self.c = client
        self.clock = clock
        self.store = STORE
        self.claims = None
        self.tokens = {}            # token -> claims, for tests that need several simultaneous callers
        self.custom_claims = {}     # uid -> custom claims set through set_custom_user_claims
        self.emails = {}            # uid -> email
        self.sent = []              # fake outgoing mail
        self.mail = {"fail": False, "unconfigured": False}
        self.deleted_auth = []

    # -- auth ---------------------------------------------------------------------------------
    def install_auth(self, mp):
        def verify(tok, *a, **k):
            if tok == "bad":
                raise ValueError("bad token")
            c = dict(self.tokens.get(tok) or self.claims)
            c.update(self.custom_claims.get(c["uid"], {}))
            return c

        class U:
            def __init__(s, uid):
                s.uid, s.custom_claims, s.email = uid, dict(self.custom_claims.get(uid, {})), self.emails.get(uid)

        def by_email(e):
            for uid, em in self.emails.items():
                if em == e:
                    return U(uid)
            raise auth.UserNotFoundError("nope")

        mp.setattr(auth, "verify_id_token", verify)
        mp.setattr(auth, "get_user", lambda uid: U(uid))
        mp.setattr(auth, "get_user_by_email", by_email)
        mp.setattr(auth, "set_custom_user_claims", lambda uid, c: self.custom_claims.__setitem__(uid, dict(c)))
        mp.setattr(auth, "delete_user", lambda uid: self.deleted_auth.append(uid))

        def fake_mail(subject, body, reply_to=None, to=None):
            if self.mail["fail"]:
                raise RuntimeError("smtp down")
            if self.mail["unconfigured"]:
                return False
            self.sent.append({"subject": subject, "body": body, "to": to, "reply_to": reply_to})
            return True

        mp.setattr(CONTACT, "send_notification_email", fake_mail)

    def who(self, uid, email, verified=True, **claims):
        self.claims = {"uid": uid, "email": email, "email_verified": verified, **claims}
        self.emails[uid] = email

    def anon(self):
        self.claims = None

    # -- raw requests -------------------------------------------------------------------------
    def req(self, uid, method, path, **kw):
        """Call as `uid`: personal-workspace claim for non-ICC users, no claim (org default) for ICC."""
        em = self.emails[uid]
        self.who(uid, em, **({"org": "personal"} if not em.endswith("@icc.org") else {}))
        hdr = dict(H)
        hdr.update(kw.pop("headers", {}))
        return getattr(self.c, method)(path, headers=hdr, **kw)

    def as_(self, uid, email, method, path, verified=True, headers=None, **claims_and_kw):
        """Call with explicit claims (for auth tests), not tied to a created user."""
        kw = {k: claims_and_kw.pop(k) for k in ("json", "data", "files", "params") if k in claims_and_kw}
        self.who(uid, email, verified=verified, **claims_and_kw)
        return getattr(self.c, method)(path, headers={**H, **(headers or {})}, **kw)

    # -- accounts ---------------------------------------------------------------------------------
    def mkuser(self, uid, plan="teacher", email=None, name=None, trial_ends=None):
        """Sign up through the real bootstrap route, then set the personal plan (admin-style)."""
        self.emails[uid] = email or f"{uid}@gmail.com"
        self.who(uid, self.emails[uid])
        r = self.c.post("/api/account/bootstrap", headers=H, json={"display_name": name or uid.title()})
        if plan:
            a = STORE[f"Accounts/{uid}"]
            a["plan"], a["plan_source"] = plan, "admin"
            a["trial_ends_at"] = (trial_ends or datetime.now(timezone.utc) + timedelta(days=20)) if plan == "trial" else None
        STORE.setdefault(f"Users/personal/teacher_profiles/{uid}", {})["display_name"] = name or uid.title()
        A.clear_cache()
        return r

    def acct(self, uid, plan, started=None, ends=None, bonus=None, orgs=()):
        """Write an Accounts doc directly (credit/period tests)."""
        STORE["Accounts/" + uid] = {
            "plan": plan, "status": "active", "plan_started_at": started or D(2026, 10, 19), "trial_ends_at": ends,
            "bonus_credits": bonus or {"courses": 0, "generates": 0, "edo_messages": 0},
            "memberships": [{"workspace": "personal"}] + [{"workspace": o, "role": "member"} for o in orgs]}
        STORE["Users/personal/teachers/" + uid] = {}
        A.clear_cache()

    def admin_plan(self, target, plan):
        self.emails["adm"] = "adm@gmail.com"
        self.who("adm", "adm@gmail.com", admin=True)
        self.c.post("/api/account/bootstrap", headers=H)
        r = self.c.patch(f"/api/admin/accounts/{target}/plan", headers=H, json={"plan": plan})
        A.clear_cache()
        return r

    # -- courses & sharing --------------------------------------------------------------------------
    def mkcourse(self, cid, owner, ws="personal", **kw):
        STORE[f"Users/{ws}/curricula/{cid}"] = {
            "courseId": cid, "teacherUid": owner, "courseName": kw.pop("courseName", cid), "isPublic": False,
            "sharedWith": [], "sharedWithUids": [], "outline": {"sections": [{"id": "s1", "title": "T"}]},
            "sections": [], **kw}

    def course(self, cid, ws="personal"):
        return STORE[f"Users/{ws}/curricula/{cid}"]

    def UC(self, uid, cid, **fields):
        return self.req(uid, "post", f"/api/update-course?teacherUid={uid}", json={"courseId": cid, **fields})

    def invite(self, uid, cid, email, access="collaborate"):
        return self.req(uid, "post", f"/api/curricula/{cid}/invites", json={"email": email, "access_type": access})

    def invites(self, status=None):
        return [v for k, v in STORE.items() if k.startswith("Invites/") and (status is None or v["status"] == status)]

    # -- credits ------------------------------------------------------------------------------------
    def pdoc(self, org, uid, pid):
        owner = "_pool" if uid is None else uid
        return STORE.get(f"Users/{org}/usage/{owner}/periods/{pid}")

    def used(self, org, uid, pid, kind):
        return ((self.pdoc(org, uid, pid) or {}).get("used") or {}).get(kind, 0)

    def held(self, org, uid, pid):
        return len((self.pdoc(org, uid, pid) or {}).get("reservations") or {})

    # -- cost log -----------------------------------------------------------------------------------
    def log_rows(self, **flt):
        CT.flush()
        out = [dict(v, _id=k) for k, v in STORE.items() if k.startswith("UsageLog/")]
        return [r for r in out if all(r.get(k) == v for k, v in flt.items())]

    def clear_log(self):
        CT.flush()
        for k in [k for k in STORE if k.startswith("UsageLog/")]:
            del STORE[k]


class Clock:
    """Controllable 'now' for the credit-period maths."""

    def __init__(self):
        self.v = D(2026, 10, 19, 12)

    def set(self, dt):
        self.v = dt


def registry():
    out = {}
    for k, v in STORE.items():
        if k.startswith("Users/") and k.count("/") == 1:
            out[k[6:]] = {
                "name": v.get("name"), "type": v.get("type"), "domains": v.get("domains", []),
                "allowed_emails": v.get("allowed_emails", []), "plan": v.get("plan"), "pool": v.get("pool"),
                "collaborator_cap": v.get("collaborator_cap"), "seats": v.get("seats"),
                "plan_started_at": v.get("plan_started_at"), "allow_public_links": v.get("allow_public_links")}
    return out


def seed_base():
    STORE["Users/icc"] = {"name": "ICC", "domains": ["icc.org"], "allowed_emails": [], "plan": "org",
                          "pool": {"courses": None, "generates": None, "edo_messages": None},
                          "collaborator_cap": None, "seats": None}
    STORE["Users/personal"] = {"name": "EdCube", "type": "personal", "domains": [], "allowed_emails": [],
                               "max_users": None, "user_count": 0}


@pytest.fixture(autouse=True)
def _isolation(monkeypatch):
    """Fresh store, fresh caches, no leftover patches for every test."""
    fakes.reset_store()
    P._org_cache.clear()
    P._personal_member_cache.clear()
    PC.clear_cache()
    A.clear_cache()
    US.clear_caches()
    SS.reset_limiters()
    GEN_MODE["v"] = "ok"
    monkeypatch.setattr(OR, "_get_registry", lambda db=None: registry())
    seed_base()
    yield
    fakes.reset_store()


@pytest.fixture
def clock(monkeypatch):
    ck = Clock()
    monkeypatch.setattr(US, "_now", lambda: ck.v)
    return ck


@pytest.fixture
def client():
    return TestClient(main.app, raise_server_exceptions=False)


@pytest.fixture
def w(client, clock, monkeypatch):
    world = World(client, clock)
    world.install_auth(monkeypatch)
    return world


@pytest.fixture
def gen_mode():
    return GEN_MODE


# ---- OpenAI / Browserbase stubs -----------------------------------------------------------------
class Usage:
    def __init__(self, p, c):
        self.prompt_tokens, self.completion_tokens, self.total_tokens = p, c, p + c


def llm_resp(p=100, c=50, model="gpt-4o-2024-08-06", content='{"a": 1}'):
    return types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content))],
                                 usage=Usage(p, c), model=model)


@pytest.fixture
def openai_stub(monkeypatch):
    """Both OpenAI entry points (sync llm_handler + async generation_service) answer from memory."""
    import routes.curriculum as C
    import utils.llm_handler as LH

    mode = {"v": "ok", "edo_content": '{"type":"conversation","message":"hi"}', "calls": 0}

    class SyncComp:
        def create(self, **kw):
            mode["calls"] += 1
            if mode["v"] == "err":
                raise RuntimeError("openai down")
            return llm_resp()

    class AsyncComp:
        async def create(self, **kw):
            mode["calls"] += 1
            if mode["v"] == "err":
                raise RuntimeError("openai exploded")
            msg = types.SimpleNamespace(content=mode["edo_content"])
            return types.SimpleNamespace(choices=[types.SimpleNamespace(message=msg)], model="gpt-4o-2024-08-06",
                                         usage=types.SimpleNamespace(total_tokens=321, prompt_tokens=300, completion_tokens=21))

    monkeypatch.setattr(LH, "client", types.SimpleNamespace(chat=types.SimpleNamespace(completions=SyncComp())))
    monkeypatch.setattr(C.generation_service, "client", types.SimpleNamespace(chat=types.SimpleNamespace(completions=AsyncComp())))
    return mode


@pytest.fixture
def browserbase_stub(monkeypatch):
    import utils.browserbase_client as BC
    from config import APIConfig

    class Resp:
        def __init__(self, d):
            self.d = d

        def raise_for_status(self):
            pass

        def json(self):
            return self.d

    def fake_post(url, **kw):
        if url.endswith("/search"):
            return Resp({"results": [{"url": "https://x.org/1", "title": "t"}]})
        return Resp({"html": "<p>hi</p>", "contentType": "text/html"})

    monkeypatch.setattr(BC, "BROWSERBASE_API_KEY", "k")
    monkeypatch.setattr(BC.requests, "post", fake_post)
    monkeypatch.setattr(APIConfig, "RESOURCE_SEARCH_PROVIDER", "browserbase")
    monkeypatch.setattr(APIConfig, "BROWSERBASE_API_KEY", "k")
    return BC
