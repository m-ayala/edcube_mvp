"""Email-domain classification (TASK-039): rules come from config, nothing blocks signup."""
import pytest

import services.domain_tagging as DT
import services.platform_config as PC
from tests.conftest import H, STORE, registry


def cls(domain):
    return DT.classify_domain(domain, registry=registry())


@pytest.mark.parametrize("domain, tag, confidence", [
    ("district.k12.ca.us", "education", "high"),
    ("mail.district.k12.ca.us", "education", "high"),
    ("stanford.edu", "education", "high"),
    ("cs.ox.ac.uk", "education", "high"),
    ("unimelb.edu.au", "education", "high"),
    ("iitb.ac.in", "education", "high"),
    ("foo.sch.uk", "education", "high"),
    ("k12.foo.com", "education", "high"),
    ("lausd.net", "education", "low"),                   # keyword guess only
    ("katyisd.org", "education", "low"),
    ("fooschools.org", "education", "low"),
    ("gmail.com", "personal", None),
    ("outlook.com", "personal", None),
    ("yahoo.co.uk", "personal", None),                   # brand label on any TLD
    ("icloud.com", "personal", None),
    ("me.com", "personal", None),
    ("protonmail.com", "personal", None),
    ("randomcompany.com", "other", None),
    ("sunrise-academy.com", "education", "low"),             # keyword hint "academy"
    ("", "other", None),
    ("icc.org", "org_registered", None),                 # a registered org's own domain
])
def test_domain_classification_table(domain, tag, confidence):
    r = cls(domain)
    assert r["tag"] == tag
    if confidence:
        assert r["confidence"] == confidence


def test_registered_org_domains_and_their_subdomains(w):
    STORE["Users/indiacc"] = {"name": "India CC", "domains": ["indiacc.org"], "allowed_emails": []}
    assert cls("indiacc.org")["tag"] == "org_registered" and cls("mail.indiacc.org")["tag"] == "org_registered"


def test_stats_key_strips_subdomains_but_keeps_the_full_domain():
    assert cls("cs.stanford.edu")["key"] == "stanford.edu" and cls("cs.stanford.edu")["domain"] == "cs.stanford.edu"
    assert cls("mail.district.k12.ca.us")["key"] == "district.k12.ca.us"
    assert cls("cs.ox.ac.uk")["key"] == "ox.ac.uk"


def test_rules_live_in_platform_config_so_an_override_changes_the_result(w):
    STORE["EdCube/platform_config"] = {"domain_rules": {"personal_domains": ["randomcompany.com"]}}
    PC.clear_cache()
    assert DT.classify_domain("randomcompany.com", registry=registry())["tag"] == "personal"
    assert DT.classify_domain("gmail.com", registry=registry())["tag"] == "personal"      # brand rules untouched


def test_bootstrap_tags_counts_once_and_never_blocks_a_domain(w):
    w.who("u1", "u1@district.k12.ca.us")
    assert w.c.post("/api/account/bootstrap", headers=H).status_code == 200
    a, d = STORE["Accounts/u1"], STORE["Domains/district.k12.ca.us"]
    assert a["domain_tag"] == "education" and d["user_count"] == 1 and d["tag"] == "education"
    w.c.post("/api/account/bootstrap", headers=H); w.c.post("/api/account/bootstrap", headers=H)
    assert STORE["Domains/district.k12.ca.us"]["user_count"] == 1             # repeat logins count nothing
    w.who("u2", "u2@mail.district.k12.ca.us")
    w.c.post("/api/account/bootstrap", headers=H)
    assert STORE["Domains/district.k12.ca.us"]["user_count"] == 2
    for uid, email in (("u3", "u3@gmail.com"), ("u4", "u4@randomcompany.com"), ("u5", "u5@weird.xyz")):
        w.who(uid, email)
        assert w.c.post("/api/account/bootstrap", headers=H).status_code == 200      # nothing is blocked
    assert not any("@" in str(v) for k, v in STORE.items() if k.startswith("Domains/"))   # no emails stored


def test_a_tagging_failure_does_not_break_signup(w, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("boom")
    monkeypatch.setattr(DT, "create_account_with_domain", boom)
    w.who("u6", "u6@stanford.edu")
    r = w.c.post("/api/account/bootstrap", headers=H)
    assert r.status_code == 200 and "Accounts/u6" in STORE and "domain_tag" not in STORE["Accounts/u6"]
