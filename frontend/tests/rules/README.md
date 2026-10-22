# Firestore security-rules tests

Tests `frontend/firestore.rules` against the Firestore **emulator**, using
`@firebase/rules-unit-testing`. Project id is `demo-edcube` (a `demo-` project never touches real
Firebase). No credentials, no network once installed.

## Requirements

* Node 20+
* **Java 11+ (JRE)**: the Firestore emulator is a Java program. This machine did not have Java when
  the tests were written, so **they have not been run yet**. Install one (for example
  `brew install openjdk@21`, then follow brew's note about linking it, or use Temurin) and check
  `java -version`.

## Run

```bash
cd frontend
npm run test:rules:install   # once: installs this folder's own deps (does not touch frontend/package-lock.json)
npm run test:rules           # starts the emulator, runs the tests, stops the emulator
```

If you already have an emulator running on port 8089 (`FIRESTORE_EMULATOR_HOST=127.0.0.1:8089`),
`cd tests/rules && npm run test:against-running-emulator` runs the tests alone.

## What is covered

* personal curricula: readable only by the owner and `sharedWithUids`
  (not by other personal users, not by `isPublic`)
* clients cannot write `sharedWith`, `sharedWithUids`, `teacherUid` (change) or `plan` fields
* `Accounts/{uid}`: self-read only, no client writes
* `ShareLinks`, `Invites`, `UsageLog`, `PaidWaitlist`, `Domains`, `OrgDomainClaims`, `AdminAudit`,
  `EdCube/platform_config`, and `Users/personal/usage`: no client access, even with an `admin` claim
* org members (by email domain or by the `org` claim) read the org library and stay out of other
  orgs and of the personal workspace; a non-member is denied
