"""Front-page blog: only admins write, everyone (no token) reads published posts, drafts stay hidden."""
import pytest

from tests.conftest import H, STORE


def _admin(w):
    w.who("adm", "manaswini.ayala@gmail.com", admin=True, name="Manaswini")


def _post(w, **kw):
    _admin(w)
    body = {"title": "Hello", "body": "First paragraph.\n\nSecond.", **kw}
    return w.c.post("/api/admin/blog/posts", headers=H, json=body)


def test_admin_publishes_and_anyone_reads(w):
    r = _post(w, published=True, summary="A short intro")
    assert r.status_code == 200
    pid = r.json()["id"]
    assert STORE[f"BlogPosts/{pid}"]["author_name"] == "Manaswini"
    w.anon()
    lst = w.c.get("/api/blog/posts")
    assert lst.status_code == 200 and [p["id"] for p in lst.json()["posts"]] == [pid]
    one = w.c.get(f"/api/blog/posts/{pid}").json()
    assert one["title"] == "Hello" and one["summary"] == "A short intro" and "published" not in one


def test_drafts_are_hidden_until_published(w):
    pid = _post(w).json()["id"]
    w.anon()
    assert w.c.get("/api/blog/posts").json()["posts"] == []
    assert w.c.get(f"/api/blog/posts/{pid}").status_code == 404
    _admin(w)
    assert [p["id"] for p in w.c.get("/api/admin/blog/posts", headers=H).json()["posts"]] == [pid]
    r = w.c.patch(f"/api/admin/blog/posts/{pid}", headers=H, json={"published": True})
    assert r.status_code == 200 and r.json()["published_at"]
    w.anon()
    assert w.c.get(f"/api/blog/posts/{pid}").status_code == 200
    _admin(w)
    w.c.patch(f"/api/admin/blog/posts/{pid}", headers=H, json={"published": False})
    w.anon()
    assert w.c.get(f"/api/blog/posts/{pid}").status_code == 404


def test_edit_delete_and_audit(w):
    pid = _post(w, published=True).json()["id"]
    r = w.c.patch(f"/api/admin/blog/posts/{pid}", headers=H, json={"title": "Renamed"})
    assert r.status_code == 200 and STORE[f"BlogPosts/{pid}"]["title"] == "Renamed"
    assert w.c.patch(f"/api/admin/blog/posts/{pid}", headers=H, json={"title": "   "}).status_code == 400
    assert w.c.delete(f"/api/admin/blog/posts/{pid}", headers=H).status_code == 200
    assert f"BlogPosts/{pid}" not in STORE
    assert w.c.delete(f"/api/admin/blog/posts/{pid}", headers=H).status_code == 404
    actions = sorted(v["action"] for k, v in STORE.items() if k.startswith("AdminAudit/"))
    assert actions == ["blog_create", "blog_delete", "blog_update"]


def test_empty_title_or_body_rejected(w):
    assert _post(w, title=" ").status_code == 400
    assert _post(w, body="").status_code == 400
    assert not any(k.startswith("BlogPosts/") for k in STORE)


@pytest.mark.parametrize("method, path, body", [
    ("get", "/api/admin/blog/posts", None),
    ("post", "/api/admin/blog/posts", {"title": "x", "body": "y", "published": True}),
    ("patch", "/api/admin/blog/posts/p1", {"title": "hacked"}),
    ("delete", "/api/admin/blog/posts/p1", None),
])
def test_non_admins_cannot_write(w, method, path, body):
    STORE["BlogPosts/p1"] = {"title": "Keep", "body": "b", "published": True}
    kw = {"json": body} if body is not None else {}
    w.who("t1", "teacher@gmail.com")
    assert getattr(w.c, method)(path, headers=H, **kw).status_code == 403
    w.anon()
    assert getattr(w.c, method)(path, **kw).status_code == 401
    assert STORE["BlogPosts/p1"]["title"] == "Keep"
    assert [k for k in STORE if k.startswith("BlogPosts/")] == ["BlogPosts/p1"]
