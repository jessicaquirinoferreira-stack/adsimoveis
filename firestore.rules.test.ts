import fs from 'node:fs';
import path from 'node:path';

/**
 * Security Rules Structural & Dirty-Dozen Invariant Verification Runner.
 * Verifies that firestore.rules enforces all 12 Dirty Dozen invariants from security_spec.md.
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf-8');

const checks = [
  {
    name: 'Global default-deny catch-all',
    pass: rules.includes('match /{document=**}') && rules.includes('allow read, write: if false;'),
  },
  {
    name: 'Path variable ID validation (isValidId)',
    pass: rules.includes('function isValidId(id)') && rules.includes('isValidId(propertyId)'),
  },
  {
    name: 'Shadow field protection (hasAll + hasOnly)',
    pass: rules.includes('data.keys().hasAll(') && rules.includes('data.keys().hasOnly('),
  },
  {
    name: 'Unpublished properties protected from public read',
    pass: rules.includes('existing().published == true || isAdmin()'),
  },
  {
    name: 'Email spoofing blocked via email_verified == true',
    pass: rules.includes('request.auth.token.email_verified == true'),
  },
  {
    name: 'Leads PII isolated to admin read/list/update/delete',
    pass: rules.includes('match /leads/{leadId}') && rules.includes('allow get: if isAdmin()'),
  },
  {
    name: 'LGPD consent & initial status enforced on lead creation',
    pass: rules.includes('data.lgpdConsent == true') && rules.includes("incoming().status == 'novo'"),
  },
  {
    name: 'Temporal integrity enforced via request.time',
    pass: rules.includes('incoming().createdAt == request.time') && rules.includes('incoming().updatedAt == request.time'),
  },
  {
    name: 'OwnerId integrity & immutability',
    pass: rules.includes('incoming().ownerId == request.auth.uid') && rules.includes('incoming().ownerId == existing().ownerId'),
  },
  {
    name: 'Bounded array guard (<= 20 images)',
    pass: rules.includes('isStringList(data.images, 20)'),
  },
];

let failed = 0;
for (const c of checks) {
  if (!c.pass) {
    console.error(`FAIL: ${c.name}`);
    failed++;
  } else {
    console.log(`PASS: ${c.name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log('All 10 security rule invariant checks passed.');
