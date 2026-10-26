import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readIdentityDocument, readLoanDraft, writeLoanDraft } from '../src/draftStorage.ts';

test('round-trips document metadata, consent and fetched identity fields without storing file bytes', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const fetchedFields = { fullName: 'Nisha Desai', fatherName: 'Vijay Desai', dateOfBirth: '1987-08-14', residentialAddress: '18 River Street' };
  const identityDocument = { fileName: 'personal-card.pdf', fileSize: 2048, fileType: 'application/pdf', uploadedAt: 123456, fetchedFields };
  const draft = {
    currentStep: 1, identityDocument, identityConsent: true, identityType: 'PAN',
    identityFetched: fetchedFields, applicant: { panNumber: 'ABCDE1234F', additionalDetails: { alternateIdNumber: 'MANUAL-ID' } }
  };
  assert.equal(writeLoanDraft('9000000001', draft), '');
  const restored = readLoanDraft('9000000001');
  assert.deepEqual(restored.identityFetched, draft.identityFetched);
  assert.equal(restored.identityConsent, true);
  assert.equal(restored.applicant.panNumber, 'ABCDE1234F');
  assert.equal(restored.applicant.additionalDetails.alternateIdNumber, 'MANUAL-ID');
  assert.deepEqual(readIdentityDocument(restored.identityDocument), identityDocument);
  assert.deepEqual(readIdentityDocument(JSON.stringify(identityDocument)), identityDocument);
  assert.equal(readIdentityDocument(null), null);
  assert.equal(readIdentityDocument('null'), null);
  delete globalThis.localStorage;
});

test('migrates existing document metadata without discarding saved upload status', () => {
  assert.deepEqual(readIdentityDocument({ name: 'old-card.png', size: 1024, type: 'image/png', lastModified: 1234 }), {
    fileName: 'old-card.png', fileSize: 1024, fileType: 'image/png', uploadedAt: 1234, fetchedFields: {}
  });
});

test('rejects invalid document metadata instead of showing a fake upload indicator', () => {
  for (const value of [{}, '{bad json', { name: 'card.pdf', size: 0 }, { name: 'card.exe', size: 10, type: 'text/plain', lastModified: 0 },
    { fileName: 'card.pdf', fileSize: 10, fileType: 'application/pdf', uploadedAt: 1234, fetchedFields: { dateOfBirth: 1990 } }]) {
    assert.throws(() => readIdentityDocument(value));
  }
});

test('reports local draft write failures', () => {
  globalThis.localStorage = { setItem: () => { throw new Error('Storage full'); } };
  const original = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    assert.match(writeLoanDraft('9000000001', { currentStep: 1 }), /could not be saved/);
    assert.equal(errors.length, 1);
  } finally {
    console.error = original;
    delete globalThis.localStorage;
  }
});
