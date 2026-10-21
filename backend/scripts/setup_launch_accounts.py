#!/usr/bin/env python3
"""
TASK-031: one-time launch setup for accounts and plans. Person-run. DRY-RUN by default;
nothing is written without --apply.

What it does (each step is skipped if already done):
  1. creates EdCube/platform_config from the code defaults (services/platform_config.py)
     if the doc is missing (an existing doc is never overwritten)
  2. creates Users/personal (the personal workspace doc) if missing
  3. sets Users/<org> (default: icc) to plan "org" with an unlimited pool
     (pool values null = unlimited; collaborator_cap / seats null = unlimited/org-defined;
     existing collaborator_cap / seats / pool values are kept)
  4. --admin-email: sets the custom claim admin=true and the Teacher plan (plan_source
     "admin") for that account. No email is hardcoded; omit the flag to skip this step.
  5. backfills an Accounts/{uid} doc (plan trial, starting now) for every existing org
     teacher that has none; existing Accounts docs only get missing memberships/fields.

Usage (from backend/, Application Default Credentials like seed_knowledge_base.py):
    python scripts/setup_launch_accounts.py --admin-email you@example.com            # dry run
    python scripts/setup_launch_accounts.py --admin-email you@example.com --apply
    python scripts/setup_launch_accounts.py --org icc --skip-backfill
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import auth

from firebase.paths import ORGS_ROOT, accounts_col, org_col, org_doc, platform_config_doc
from firebase.project import firestore_client
from firebase.public_space import (
    ADMIN_CLAIM,
    PERSONAL_SPACE_IDS,
    PERSONAL_SPACE_ID,
    PLAN_ORG,
    PLAN_TEACHER,
    default_personal_space_doc,
)
from services import accounts_service as accts
from services import platform_config as pc

SCRIPT_ADMIN = {"uid": "script:setup_launch_accounts", "email": None}
UNLIMITED_POOL = {k: None for k in pc.LIMIT_KINDS}


def say(dry, msg):
    print(f"{'[dry-run] would ' if dry else ''}{msg}")


def step_platform_config(db, dry):
    ref = platform_config_doc(db)
    if ref.get().exists:
        print("EdCube/platform_config already exists -- left untouched.")
        return
    say(dry, "create EdCube/platform_config from code defaults "
             f"(trial_length_days={pc.DEFAULT_PLATFORM_CONFIG['trial_length_days']}, a PLACEHOLDER)")
    if not dry:
        ref.set(pc.config_document_body())


def step_personal_space(db, dry):
    ref = org_doc(db, PERSONAL_SPACE_ID)
    if ref.get().exists:
        print(f"Users/{PERSONAL_SPACE_ID} already exists -- left untouched.")
        return
    say(dry, f"create Users/{PERSONAL_SPACE_ID} (no signup cap)")
    if not dry:
        ref.set(default_personal_space_doc())


def step_org_plan(db, org_id, dry):
    ref = org_doc(db, org_id)
    snap = ref.get()
    if not snap.exists:
        print(f"Users/{org_id} does not exist -- skipping org plan (create the org first).")
        return
    cur = snap.to_dict() or {}
    patch = {}
    if cur.get("plan") != PLAN_ORG:
        patch["plan"] = PLAN_ORG
    if not isinstance(cur.get("pool"), dict):
        patch["pool"] = dict(UNLIMITED_POOL)
    for k in ("collaborator_cap", "seats"):
        if k not in cur:
            patch[k] = None
    if not patch:
        print(f"Users/{org_id} already on the org plan -- left untouched.")
        return
    say(dry, f"update Users/{org_id}: {patch}")
    if not dry:
        ref.update(patch)


def step_admin(db, email, dry):
    if not email:
        print("--admin-email not given -- skipping the admin/Teacher step.")
        return
    try:
        user = auth.get_user_by_email(email)
    except Exception as e:
        print(f"Admin step: no auth user for {email} ({e}). Sign up first, then re-run.")
        return
    claims = dict(user.custom_claims or {})
    if claims.get(ADMIN_CLAIM) is not True:
        say(dry, f"set custom claim admin=true on {email} (uid {user.uid}); takes effect on next token refresh")
        if not dry:
            claims[ADMIN_CLAIM] = True
            auth.set_custom_user_claims(user.uid, claims)
    else:
        print(f"{email} already has the admin claim.")
    acct = accts.get_account(user.uid, db, fresh=True)
    if acct is None:
        say(dry, f"create Accounts/{user.uid} for {email}")
    elif not acct.get("is_admin"):
        say(dry, f"set is_admin=true on Accounts/{user.uid}")
    if not dry:
        acct = accts.ensure_account(user.uid, email, is_admin=True, db=db)   # idempotent create/mirror
    if acct is None or accts.personal_plan(acct) != PLAN_TEACHER or acct.get("plan_source") != accts.PLAN_SOURCE_ADMIN:
        say(dry, f"set plan {PLAN_TEACHER} (plan_source admin) on Accounts/{user.uid}")
        if not dry:
            patch = accts.set_plan(user.uid, PLAN_TEACHER, db=db)
            accts.log_admin_action(SCRIPT_ADMIN, "set_plan", user.uid, {"plan": acct.get("plan")}, patch, db)
    else:
        print(f"Accounts/{user.uid} already on {PLAN_TEACHER}.")


def step_backfill(db, dry):
    created = touched = skipped = 0
    for org in db.collection(ORGS_ROOT).stream():
        if org.id in PERSONAL_SPACE_IDS:
            continue
        for t in org_col(db, org.id, "teachers").stream():
            uid = t.id
            data = t.to_dict() or {}
            email = data.get("email") or ""
            try:
                if not email:
                    email = auth.get_user(uid).email or ""
            except Exception as e:
                skipped += 1
                print(f"  skipped uid {uid}: {e}")
                continue
            existing = accts.get_account(uid, db, fresh=True)
            if existing is None:
                created += 1
                say(dry, f"create Accounts/{uid} ({email}, org {org.id}, plan trial)")
            else:
                touched += 1
            if not dry:
                accts.ensure_account(uid, email, org_id=org.id, db=db)
    print(f"Backfill: {created} Accounts to create, {touched} existing checked for missing fields, {skipped} skipped.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="actually write (default is a dry run)")
    ap.add_argument("--admin-email", help="account to make admin + Teacher plan (no default)")
    ap.add_argument("--org", default="icc", help="org to put on the org plan (default icc)")
    ap.add_argument("--skip-backfill", action="store_true")
    args = ap.parse_args()
    dry = not args.apply

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore_client()
    print(f"== setup_launch_accounts ({'DRY RUN -- pass --apply to write' if dry else 'APPLY'}) ==")
    step_platform_config(db, dry)
    step_personal_space(db, dry)
    step_org_plan(db, args.org, dry)
    step_admin(db, args.admin_email, dry)
    if not args.skip_backfill:
        step_backfill(db, dry)
    print("Done." if not dry else "Dry run complete; nothing was written.")


if __name__ == "__main__":
    main()
