// Security-rules tests for frontend/firestore.rules. Run with `npm run test:rules` from frontend/
// (needs Java for the Firestore emulator; see README.md).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { before, after, beforeEach, describe, it } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(here, '../../firestore.rules'), 'utf8');

let env;

// --- identities -------------------------------------------------------------------------------
// Non-org ("personal") users carry the claim org: 'personal'. Org members are matched by email domain.
const personal = (uid, extra = {}) =>
  env.authenticatedContext(uid, { email: `${uid}@gmail.com`, email_verified: true, org: 'personal', ...extra }).firestore();
const orgUser = (uid, email, claims = {}) =>
  env.authenticatedContext(uid, { email, email_verified: true, ...claims }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// --- seed (rules disabled) ----------------------------------------------------------------------
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path, data) => setDoc(doc(db, path), data);
    await put('Users/personal', { name: 'EdCube', type: 'personal', domains: [], allowed_emails: [] });
    for (const u of ['alice', 'bob', 'carol']) await put(`Users/personal/teachers/${u}`, { display_name: u });
    await put('Users/personal/curricula/c1', {
      teacherUid: 'alice', courseName: 'Shared', isPublic: true,
      sharedWith: [{ uid: 'bob', accessType: 'view' }], sharedWithUids: ['bob'],
    });
    await put('Users/personal/curricula/c2', { teacherUid: 'alice', courseName: 'Private', sharedWith: [], sharedWithUids: [] });
    await put('Users/personal/notifications/n1', { toUid: 'alice', type: 'x' });
    await put('Users/personal/usage/alice/periods/trial', { used: { courses: 1 } });
    await put('Accounts/alice', { plan: 'trial', email: 'alice@gmail.com' });
    await put('Accounts/bob', { plan: 'teacher', email: 'bob@gmail.com' });
    await put('ShareLinks/tok123', { course_id: 'c1', workspace: 'personal', owner_uid: 'alice' });
    await put('Invites/i1', { email: 'x@y.com', token: 'secret', status: 'pending' });
    await put('UsageLog/l1', { uid: 'alice' });
    await put('PaidWaitlist/w1', { email: 'alice@gmail.com' });
    await put('Domains/gmail.com', { user_count: 3 });
    await put('OrgDomainClaims/oc1', { org: 'icc' });
    await put('AdminAudit/a1', { action: 'set_plan' });
    await put('EdCube/platform_config', { trial_length_days: 30 });
    await put('EdCube/knowledge_base', { seeded: true });
    await put('EdCube/knowledge_base/pedagogy/p1', { name: 'x' });
    await put('Users/icc', { name: 'ICC', domains: ['icc.org'], allowed_emails: [] });
    await put('Users/icc/curricula/oc1', { teacherUid: 'o1', courseName: 'Org course', isPublic: true });
    await put('Users/icc/teacher_profiles/o1', { display_name: 'O1' });
    await put('Users/other', { name: 'Other', domains: ['other.org'], allowed_emails: [] });
    await put('Users/other/curricula/x1', { teacherUid: 'z1', courseName: 'Not yours' });
  });
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-edcube', firestore: { rules: RULES } });
});
after(async () => { await env?.cleanup(); });
beforeEach(seed);

// -----------------------------------------------------------------------------------------------
describe('personal curricula: readable only by the owner and sharedWithUids', () => {
  it('owner can read', () => assertSucceeds(getDoc(doc(personal('alice'), 'Users/personal/curricula/c1'))));
  it('a user in sharedWithUids can read', () => assertSucceeds(getDoc(doc(personal('bob'), 'Users/personal/curricula/c1'))));
  it('another personal user cannot read, even when isPublic is true', () =>
    assertFails(getDoc(doc(personal('carol'), 'Users/personal/curricula/c1'))));
  it('a shared user cannot read a different, unshared course', () =>
    assertFails(getDoc(doc(personal('bob'), 'Users/personal/curricula/c2'))));
  it('signed-out visitors cannot read', () => assertFails(getDoc(doc(anon(), 'Users/personal/curricula/c1'))));
  it('listing everything is refused, listing your own is allowed', async () => {
    await assertFails(getDocs(collection(personal('carol'), 'Users/personal/curricula')));
    await assertSucceeds(getDocs(query(collection(personal('alice'), 'Users/personal/curricula'), where('teacherUid', '==', 'alice'))));
  });
  it('an org member (no personal teachers doc) cannot read the personal workspace', () =>
    assertFails(getDoc(doc(orgUser('o1', 'o1@icc.org', { org: 'icc' }), 'Users/personal/curricula/c1'))));
});

describe('clients cannot write sharing, ownership or plan fields', () => {
  it('owner cannot add themselves a collaborator (sharedWithUids)', () =>
    assertFails(updateDoc(doc(personal('alice'), 'Users/personal/curricula/c2'), { sharedWithUids: ['carol'] })));
  it('owner cannot edit sharedWith', () =>
    assertFails(updateDoc(doc(personal('alice'), 'Users/personal/curricula/c2'), { sharedWith: [{ uid: 'carol', accessType: 'collaborate' }] })));
  it('owner cannot hand the course to someone else (teacherUid)', () =>
    assertFails(updateDoc(doc(personal('alice'), 'Users/personal/curricula/c2'), { teacherUid: 'carol' })));
  it('owner can edit ordinary fields', () =>
    assertSucceeds(updateDoc(doc(personal('alice'), 'Users/personal/curricula/c2'), { courseName: 'Renamed' })));
  it('a collaborator cannot write directly (edits go through the backend)', async () => {
    await assertFails(updateDoc(doc(personal('bob'), 'Users/personal/curricula/c1'), { courseName: 'x' }));
    await assertFails(deleteDoc(doc(personal('bob'), 'Users/personal/curricula/c1')));
  });
  it('create must be yours and start with no sharing', async () => {
    await assertSucceeds(setDoc(doc(personal('carol'), 'Users/personal/curricula/new1'), { teacherUid: 'carol', sharedWith: [], sharedWithUids: [] }));
    await assertFails(setDoc(doc(personal('carol'), 'Users/personal/curricula/new2'), { teacherUid: 'alice' }));
    await assertFails(setDoc(doc(personal('carol'), 'Users/personal/curricula/new3'), { teacherUid: 'carol', sharedWithUids: ['alice'] }));
  });
  it('owner can delete their course, others cannot', async () => {
    await assertFails(deleteDoc(doc(personal('carol'), 'Users/personal/curricula/c2')));
    await assertSucceeds(deleteDoc(doc(personal('alice'), 'Users/personal/curricula/c2')));
  });
  // Guards the `{sub}/{rest=**}` subcollection rule: a bare `{x=**}` would also match this doc
  // (zero segments) and OR-in a plain owner-write that bypasses the plan guard.
  it('plan fields on the personal teachers doc are not client-writable', async () => {
    await assertFails(updateDoc(doc(personal('alice'), 'Users/personal/teachers/alice'), { plan: 'teacher' }));
    await assertFails(updateDoc(doc(personal('alice'), 'Users/personal/teachers/alice'), { plan_updated_at: 1 }));
    await assertFails(setDoc(doc(personal('erin'), 'Users/personal/teachers/erin'), { plan: 'teacher' }));
    await assertSucceeds(setDoc(doc(personal('erin'), 'Users/personal/teachers/erin'), { display_name: 'Erin' }));
    await assertSucceeds(updateDoc(doc(personal('alice'), 'Users/personal/teachers/alice'), { display_name: 'A2' }));
  });
  it('a user cannot read or write someone else\'s teachers doc', async () => {
    await assertFails(getDoc(doc(personal('alice'), 'Users/personal/teachers/bob')));
    await assertFails(updateDoc(doc(personal('alice'), 'Users/personal/teachers/bob'), { display_name: 'hax' }));
  });
});

describe('Accounts: self-read only, never client-written', () => {
  it('reads own account', () => assertSucceeds(getDoc(doc(personal('alice'), 'Accounts/alice'))));
  it('cannot read another account', () => assertFails(getDoc(doc(personal('alice'), 'Accounts/bob'))));
  it('signed-out cannot read', () => assertFails(getDoc(doc(anon(), 'Accounts/alice'))));
  it('cannot write own account (plan, credits, admin flag)', async () => {
    await assertFails(updateDoc(doc(personal('alice'), 'Accounts/alice'), { plan: 'teacher' }));
    await assertFails(setDoc(doc(personal('alice'), 'Accounts/alice'), { plan: 'org', is_admin: true }));
    await assertFails(deleteDoc(doc(personal('alice'), 'Accounts/alice')));
  });
});

describe('backend-only collections are closed to every client', () => {
  const closed = [
    'ShareLinks/tok123', 'Invites/i1', 'UsageLog/l1', 'PaidWaitlist/w1', 'Domains/gmail.com',
    'OrgDomainClaims/oc1', 'AdminAudit/a1', 'EdCube/platform_config', 'Users/personal/usage/alice/periods/trial',
  ];
  for (const path of closed) {
    it(`${path}: read and write denied (even for an admin-claim user)`, async () => {
      for (const db of [personal('alice'), personal('root', { admin: true }), anon()]) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { hacked: true }));
        await assertFails(deleteDoc(doc(db, path)));
      }
    });
  }
  it('listing ShareLinks / Invites is refused too', async () => {
    await assertFails(getDocs(collection(personal('alice'), 'ShareLinks')));
    await assertFails(getDocs(collection(personal('alice'), 'Invites')));
  });
  it('the knowledge base is read-only for signed-in users', async () => {
    await assertSucceeds(getDoc(doc(personal('alice'), 'EdCube/knowledge_base/pedagogy/p1')));
    await assertFails(getDoc(doc(anon(), 'EdCube/knowledge_base/pedagogy/p1')));
    await assertFails(setDoc(doc(personal('alice'), 'EdCube/knowledge_base/pedagogy/p1'), { name: 'y' }));
  });
});

describe('org library', () => {
  it('a member (by email domain) can read the org course library', () =>
    assertSucceeds(getDoc(doc(orgUser('o2', 'o2@icc.org'), 'Users/icc/curricula/oc1'))));
  it('a member (by org claim) can read it', () =>
    assertSucceeds(getDoc(doc(orgUser('o3', 'o3@somewhere.net', { org: 'icc' }), 'Users/icc/curricula/oc1'))));
  it('a member can list the org library', () =>
    assertSucceeds(getDocs(collection(orgUser('o2', 'o2@icc.org'), 'Users/icc/curricula'))));
  it('a non-member (personal user) is denied', async () => {
    await assertFails(getDoc(doc(personal('alice'), 'Users/icc/curricula/oc1')));
    await assertFails(getDocs(collection(personal('alice'), 'Users/icc/curricula')));
  });
  it('a member of a different org is denied', () =>
    assertFails(getDoc(doc(orgUser('z1', 'z1@other.org'), 'Users/icc/curricula/oc1'))));
  it('an unverified email is not trusted, not even for your own personal course', () =>
    assertFails(getDoc(doc(env.authenticatedContext('alice', { email: 'alice@gmail.com', email_verified: false, org: 'personal' }).firestore(),
      'Users/personal/curricula/c1'))));
  it('signed-out visitors are denied', () => assertFails(getDoc(doc(anon(), 'Users/icc/curricula/oc1'))));
  it('a member cannot edit or delete another member\'s course', async () => {
    const db = orgUser('o2', 'o2@icc.org');
    await assertFails(updateDoc(doc(db, 'Users/icc/curricula/oc1'), { courseName: 'mine now' }));
    await assertFails(deleteDoc(doc(db, 'Users/icc/curricula/oc1')));
  });
  it('the owner can edit their own org course', () =>
    assertSucceeds(updateDoc(doc(orgUser('o1', 'o1@icc.org'), 'Users/icc/curricula/oc1'), { courseName: 'Edited' })));
  it('a member can only create a course as themselves', async () => {
    const db = orgUser('o2', 'o2@icc.org');
    await assertSucceeds(setDoc(doc(db, 'Users/icc/curricula/mine'), { teacherUid: 'o2' }));
    await assertFails(setDoc(doc(db, 'Users/icc/curricula/theirs'), { teacherUid: 'o1' }));
  });
});
