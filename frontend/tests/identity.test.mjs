import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_FILE_SIZE, MIN_IDENTITY_OCR_CONFIDENCE, confidentIdentityText, lookupIdentityNumber, resolveIdentityExtraction, isValidAadhaar, maskAadhaar, maskAadhaarEntry, editAadhaarEntry, parseIdentityText, readIdentityFields, validateIdentity, validateIdentityFile } from '../src/identity.ts';

const pdf = new File(['%PDF-1.4'], 'identity.pdf', { type: 'application/pdf' });

test('extracts name and DOB from noisy Aadhaar OCR, ignoring issue dates and misread digits', () => {
  const noisy = [
    'Issue Date: 12/03/2019',
    'भारत सरकार ~~ GOVERNMENT OF INDIA',
    'Priya Verma',
    '%$# ¥ 3@ =~ |',
    'ao fafa / DOB : O7/1l/1992',
    'महिला / FEMALE',
    '4991 1866 5246'
  ].join('\n');
  const fields = parseIdentityText(noisy, 'AADHAAR');
  assert.equal(fields.fullName, 'Priya Verma');
  assert.equal(fields.dateOfBirth, '1992-11-07');
  assert.equal(fields.gender, 'Female');
});

test('extracts name when OCR merges it onto the DOB line', () => {
  const fields = parseIdentityText('GOVERNMENT OF INDIA\nPriya Verma DOB: 07-11-1992 FEMALE', 'AADHAAR');
  assert.equal(fields.fullName, 'Priya Verma');
  assert.equal(fields.dateOfBirth, '1992-11-07');
});

test('parses PAN father name written with a typographic apostrophe', () => {
  const fields = parseIdentityText('AAAPN1234Q\nName\nARJUN NAIR\nFather\u2019s Name\nMOHAN NAIR\nDate of Birth\n01/01/1990', 'PAN');
  assert.equal(fields.fatherName, 'Mohan Nair');
  assert.equal(fields.fullName, 'Arjun Nair');
});

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

test('maps extracted name and dob aliases to the controlled applicant fields', () => {
  assert.deepEqual(readIdentityFields({ fields: {
    name: ' Priya Verma ', dob: '07/11/1992', aadhaarNumber: '499118665246',
    city: 'Indore', state: 'Madhya Pradesh', pincode: '452001'
  } }), {
    fullName: 'Priya Verma', dateOfBirth: '1992-11-07', aadhaarNumber: 'XXXXXXXX5246',
    city: 'Indore', state: 'Madhya Pradesh', pincode: '452001'
  });
});

test('prefers canonical identity keys and falls back from blank keys', () => {
  assert.deepEqual(readIdentityFields({ fields: {
    fullName: 'Canonical Name', name: 'Alias Name', dateOfBirth: '1990-01-02', dob: '03/04/1995'
  } }), { fullName: 'Canonical Name', dateOfBirth: '1990-01-02' });
  assert.deepEqual(readIdentityFields({ fields: {
    fullName: ' ', name: 'Alias Name', dateOfBirth: '', dob: '7-11-1992'
  } }), { fullName: 'Alias Name', dateOfBirth: '1992-11-07' });
});

test('normalizes DOB for date inputs without mapping impossible dates', () => {
  for (const dateOfBirth of ['07/11/1992', '07-11-1992', '07.11.1992', '1992-11-07']) {
    assert.equal(readIdentityFields({ fields: { dateOfBirth } }).dateOfBirth, '1992-11-07');
  }
  assert.deepEqual(readIdentityFields({ fields: { fullName: 'Test Applicant', dob: '31/02/1990' } }), {
    fullName: 'Test Applicant'
  });
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

test('parses an OCR\'d Aadhaar card without inventing values and masks the number', () => {
  const text = [
    'GOVERNMENT OF INDIA',
    'Priya Verma',
    'DOB: 07/11/1992',
    'FEMALE',
    '4991 1866 5246',
    'Address: D/O Anil Verma, 14 Lake View Road,',
    'Indore, Madhya Pradesh - 452001'
  ].join('\n');
  assert.deepEqual(parseIdentityText(text, 'AADHAAR'), {
    fullName: 'Priya Verma', dateOfBirth: '1992-11-07', gender: 'Female', aadhaarNumber: 'XXXXXXXX5246',
    fatherName: 'Anil Verma', residentialAddress: '14 Lake View Road, Indore, Madhya Pradesh - 452001', pincode: '452001'
  });
});

test('parses labelled and legacy PAN card layouts', () => {
  const labelled = 'INCOME TAX DEPARTMENT GOVT. OF INDIA\nPermanent Account Number Card\nBNZPM2501F\nName\nKAVITA MENON\nFather\'s Name\nRAJAN MENON\nDate of Birth\n23/02/1988';
  assert.deepEqual(parseIdentityText(labelled, 'PAN'), {
    dateOfBirth: '1988-02-23', panNumber: 'BNZPM2501F', fullName: 'Kavita Menon', fatherName: 'Rajan Menon'
  });
  const legacy = 'INCOME TAX DEPARTMENT GOVT. OF INDIA\nARJUN NAIR\nMOHAN NAIR\n01/01/1990\nPermanent Account Number\nAAAPN1234Q';
  assert.deepEqual(parseIdentityText(legacy, 'PAN'), {
    dateOfBirth: '1990-01-01', panNumber: 'AAAPN1234Q', fullName: 'Arjun Nair', fatherName: 'Mohan Nair'
  });
});

test('extracts Aadhaar father names from labels and standalone relation lines', () => {
  const front = 'GOVERNMENT OF INDIA\nPriya Verma\nDOB: 07/11/1992\nFEMALE\n';
  for (const line of ["Father's Name: Anil Verma", 'Father Name\nAnil Verma', 'S/O: Anil Verma', 'D / O Anil Verma']) {
    const fields = parseIdentityText(front + line, 'AADHAAR');
    assert.equal(fields.fatherName, 'Anil Verma', line);
    assert.equal(fields.fullName, 'Priya Verma');
    assert.equal(fields.dateOfBirth, '1992-11-07');
    assert.equal(fields.gender, 'Female');
    assert.equal(readIdentityFields({ fields }).fatherName, 'Anil Verma');
  }
  for (const line of ['W/O: Anil Verma', 'C/O: Anil Verma', 'Care of: Anil Verma']) {
    assert.equal(parseIdentityText(front + line, 'AADHAAR').fatherName, 'Anil Verma');
  }
});

test('extracts distinct uploaded identities from To and care-of layouts without using lookup records', () => {
  for (const [name, parent, dob] of [
    ['Nisha Desai', 'Vijay Desai', '14/08/1987'],
    ['Dev Kapoor', 'Ramesh Kapoor', '26-03-1994']
  ]) {
    const text = `GOVERNMENT OF INDIA\nTo\n${name}\nC / O:\n${parent}\n18 River Street\nPune Maharashtra 411001\nDOB: ${dob}\nXXXX XXXX 6789`;
    const fields = parseIdentityText(text, 'AADHAAR');
    assert.equal(fields.fullName, name);
    assert.equal(fields.fatherName, parent);
    assert.equal(fields.dateOfBirth, dob.slice(6) + '-' + dob.slice(3, 5) + '-' + dob.slice(0, 2));
    assert.equal(fields.aadhaarNumber, 'XXXXXXXX6789');
    assert.equal(fields.residentialAddress, '18 River Street, Pune Maharashtra 411001');
    assert.equal(fields.pincode, '411001');
  }
});

test('does not invent personal details from a number or low-confidence OCR', () => {
  assert.deepEqual(lookupIdentityNumber('PAN', 'BNZPM2501F'), { panNumber: 'BNZPM2501F' });
  assert.deepEqual(lookupIdentityNumber('AADHAAR', '499118665246'), { aadhaarNumber: 'XXXXXXXX5246' });
  const text = 'Name: Nisha Desai\nDOB: 14/08/1987';
  for (const confidence of [NaN, 0, MIN_IDENTITY_OCR_CONFIDENCE - 1]) {
    assert.equal(confidentIdentityText(text, confidence), '');
    assert.throws(() => resolveIdentityExtraction(confidentIdentityText(text, confidence), 'PAN'), /could not read/);
  }
  assert.equal(confidentIdentityText(text, MIN_IDENTITY_OCR_CONFIDENCE), text);
  assert.equal(parseIdentityText("Name\n[unreadable]\nFather's Name\nVijay Desai\nDOB: 14/08/1987", 'PAN').fullName, undefined);
});

test('DOB comes only from the current document in day-first or ISO formats', () => {
  for (const [date, expected] of [
    ['09/04/1986', '1986-04-09'], ['21-12-1998', '1998-12-21'], ['1979-06-18', '1979-06-18']
  ]) {
    assert.equal(resolveIdentityExtraction(`Name: Meera Joshi\nDOB: ${date}`, 'PAN').dateOfBirth, expected);
  }
  for (const text of [
    'Name: Meera Joshi',
    'Name: Meera Joshi\nIssue Date: 01/01/2020',
    'Name: Meera Joshi\nDOB: unreadable\n01/01/2020',
    'Name: Meera Joshi\nDOB: 31/02/1990\nIssue Date: 01/01/2020',
    'Name: Meera Joshi\n01/01/1990\n02/02/1991'
  ]) {
    assert.equal(resolveIdentityExtraction(text, 'PAN').dateOfBirth, undefined, text);
  }
});

test('returns nothing for unreadable text and rejects Aadhaar numbers failing the checksum', () => {
  assert.deepEqual(parseIdentityText('~~ ## ..\n@@', 'AADHAAR'), {});
  assert.deepEqual(parseIdentityText('', 'PAN'), {});
  assert.equal(parseIdentityText('1234 5678 9012', 'AADHAAR').aadhaarNumber, undefined);
  assert.ok(isValidAadhaar('499118665246'));
  assert.ok(!isValidAadhaar('499118665247'));
  assert.equal(parseIdentityText('DOB: 31/02/1990', 'PAN').dateOfBirth, undefined);
});
