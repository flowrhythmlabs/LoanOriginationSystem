import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_FILE_SIZE, maskAadhaar, maskAadhaarEntry, editAadhaarEntry, mockIdentityFields, readIdentityFields, validateIdentity, validateIdentityFile } from '../src/identity.ts';

const pdf = new File(['%PDF-1.4'], 'identity.pdf', { type: 'application/pdf' });

test('requires selection, a valid number or document, and explicit consent', () => {
  assert.match(validateIdentity('', '', pdf, true), /Select/);
  assert.match(validateIdentity('PAN', 'ABCDE1234F', null, false), /consent/);
  assert.match(validateIdentity('AADHAAR', '1234', null, true), /valid/);
  assert.match(validateIdentity('AADHAAR', '123456789012', null, true), /valid/);
  assert.match(validateIdentity('PAN', 'invalid', null, true), /valid/);
  assert.equal(validateIdentity('AADHAAR', '234567890123', null, true), '');
  assert.equal(validateIdentity('PAN', 'ABCDE1234F', null, true), '');
  assert.equal(validateIdentity('AADHAAR', '', pdf, true), '');
  assert.equal(validateIdentity('PAN', '', pdf, true), '');
});

test('validates PDF/JPG/PNG uploads and the exact 5 MB limit', () => {
  for (const [name, type] of [['identity.pdf', 'application/pdf'], ['identity.jpg', 'image/jpeg'], ['identity.png', 'image/png']]) {
    assert.equal(validateIdentityFile({ name, type, size: MAX_FILE_SIZE }), '');
    assert.match(validateIdentityFile({ name, type, size: MAX_FILE_SIZE + 1 }), /5 MB/);
  }
  assert.match(validateIdentityFile({ name: 'identity.pdf', type: 'application/pdf', size: 0 }), /empty/);
  assert.match(validateIdentityFile({ name: 'identity.exe', type: 'application/pdf', size: 10 }), /not supported/);
  assert.match(validateIdentityFile({ name: 'identity.pdf', type: 'text/plain', size: 10 }), /not supported/);
  assert.match(validateIdentity('PAN', 'ABCDE1234F', new File(['bad'], 'bad.txt', { type: 'text/plain' }), true), /not supported/);
});

test('never shows more than the last four Aadhaar digits', () => {
  assert.equal(maskAadhaar('234567890123'), 'XXXXXXXX0123');
  assert.equal(maskAadhaar('XXXXXXXX0123'), 'XXXXXXXX0123');
  assert.equal(maskAadhaar(''), '');
});

test('uses only nonempty applicable fields from a response and masks Aadhaar', () => {
  const fields = readIdentityFields({ fields: {
    fullName: ' Test Applicant ', dateOfBirth: '1990-01-01', gender: 'Other',
    fatherName: 'Test Parent', residentialAddress: 'Test Address',
    panNumber: 'ABCDE1234F', aadhaarNumber: '234567890123',
    email: '', city: null, providerReference: 'ignored', coApplicantName: 'ignored'
  } });
  assert.equal(Object.keys(fields).length, 7);
  assert.equal(fields.fullName, 'Test Applicant');
  assert.equal(fields.aadhaarNumber, 'XXXXXXXX0123');
  assert.equal(fields.email, undefined);
  assert.equal(fields.coApplicantName, undefined);
  assert.deepEqual(readIdentityFields({ fields: JSON.parse(JSON.stringify(fields)) }), fields);
});

test('rejects malformed and empty responses instead of inventing details', () => {
  for (const payload of [null, {}, { fields: null }, { fields: {} }, { fields: { fullName: ' ' } }]) {
    assert.throws(() => readIdentityFields(payload));
  }
});

test('masks Aadhaar entry while retaining digits for number validation and submission', () => {
  let raw = '';
  for (const digit of '234567890123') {
    raw = editAadhaarEntry(raw, maskAadhaarEntry(raw) + digit);
    assert.ok((maskAadhaarEntry(raw).match(/\d/g) || []).length <= 4);
  }
  assert.equal(raw, '234567890123');
  assert.equal(maskAadhaarEntry(raw), 'XXXXXXXX0123');
  assert.equal(editAadhaarEntry(raw, 'XXXXXXXX012'), '23456789012');
  assert.equal(editAadhaarEntry(raw, 'XXXXXX890123'), '234567890123');
  assert.equal(editAadhaarEntry(raw, ''), '');
  assert.equal(editAadhaarEntry(raw, '345678901234'), '345678901234');
  assert.equal(editAadhaarEntry(raw, 'XXX9XXXX0123'), '234967890123');
  assert.equal(validateIdentity('AADHAAR', raw, null, true), '');
});

test('development fallback contains exactly the seven requested fields and only masked Aadhaar', () => {
  assert.deepEqual(mockIdentityFields(), {
    fullName: 'Rahul Sharma', dateOfBirth: '1995-05-15', gender: 'Male',
    fatherName: 'Suresh Sharma', residentialAddress: '123 Main Street, Varanasi, UP, 221006',
    panNumber: 'ABCDE1234F', aadhaarNumber: 'XXXXXXXX9012'
  });
  const changed = mockIdentityFields();
  changed.fullName = 'Edited';
  assert.equal(mockIdentityFields().fullName, 'Rahul Sharma');
});
