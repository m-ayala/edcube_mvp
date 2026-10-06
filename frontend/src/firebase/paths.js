// frontend/src/firebase/paths.js
//
// Firestore path helpers for the `EdCube` / `Users/{org}` tree -- the web SDK
// mirror of `backend/firebase/paths.py`. This module is the *only* place in
// the frontend that should know the shape of that tree; every other module
// reaches Firestore collections through the helpers here instead of calling
// `collection(db, 'some_name')` directly, so the tree shape can change in one
// place (tasks/firestore-reorg-spec.md, TASK-008).
//
// Target tree:
//
//     EdCube/knowledge_base/{category}/{doc}       -- platform-wide KB
//         categories: curriculum, pedagogy, impact_partners, content,
//                     worksheets, activities, age
//
//     Users/{org}/curricula/{id}
//     Users/{org}/teacher_profiles/{uid}
//     Users/{org}/teachers/{uid}/courseFolders/**, libraryFolders/**
//     Users/{org}/notifications/{id}                -- short-lived, delete-on-seen
//     Users/{org}/synopsis/afterschool/months/**, entries/**
//     Users/{org}/synopsis/summer_camps/weeks/{week}/camps/{camp}/entries/**
//
// Org resolution on the frontend comes from `GET /api/orgs/check-email`
// (exposed via `checkEmailOrg` in `firebase/authService.js` and cached on the
// auth context, see `contexts/AuthContext.jsx`) -- there is no frontend
// `DOMAIN_ORG_MAP` and no default org (tasks/firestore-reorg-spec.md Round 2,
// section G).

import { doc, collection } from 'firebase/firestore';

export const ORGS_ROOT = 'Users';
export const PLATFORM_ROOT = 'EdCube';
export const KNOWLEDGE_BASE_DOC = 'knowledge_base';

/** `Users/{org}` -- the per-organization root document. */
export function orgDoc(db, org) {
  return doc(db, ORGS_ROOT, org);
}

/** `Users/{org}/{name}` -- a subcollection scoped to one organization. */
export function orgCol(db, org, name) {
  return collection(orgDoc(db, org), name);
}

/** `Users/{org}/{name}/{docId}` -- a document inside an org-scoped subcollection. */
export function orgSubDoc(db, org, name, docId) {
  return doc(orgCol(db, org, name), docId);
}

/** `Users/{org}/teachers/{uid}/{subName}` e.g. 'courseFolders', 'libraryFolders'. */
export function teacherSubCol(db, org, uid, subName) {
  return collection(orgSubDoc(db, org, 'teachers', uid), subName);
}

/** `Users/{org}/teachers/{uid}/{subName}/{docId}`. */
export function teacherSubDoc(db, org, uid, subName, docId) {
  return doc(teacherSubCol(db, org, uid, subName), docId);
}

/** `EdCube/knowledge_base` */
export function kbDoc(db) {
  return doc(db, PLATFORM_ROOT, KNOWLEDGE_BASE_DOC);
}

/** `EdCube/knowledge_base/{category}` e.g. 'pedagogy', 'age', 'worksheets'. */
export function kbCol(db, category) {
  return collection(kbDoc(db), category);
}
