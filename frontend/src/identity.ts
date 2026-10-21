export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export type IdentityType = '' | 'AADHAAR' | 'PAN';

export const IDENTITY_FIELDS = [
  'fullName', 'dateOfBirth', 'panNumber', 'mobileNumber', 'email', 'workEmail',
  'residentialAddress', 'city', 'state', 'pincode',
  'gender', 'fatherName', 'motherName', 'spouseName', 'nationality',
  'residentialStatus', 'maritalStatus', 'education', 'alternateMobile',
  'permanentAddress', 'aadhaarNumber'
] as const;
export type IdentityField = typeof IDENTITY_FIELDS[number];
export type IdentityFields = Partial<Record<IdentityField, string>>;

export const maskAadhaar = (value: string) => value ? `XXXXXXXX${value.slice(-4)}` : '';

export const maskAadhaarEntry = (value: string) => value.replace(/\d(?=\d{4})/g, 'X');

export function editAadhaarEntry(previous: string, entered: string): string {
  if (/^\d*$/.test(entered)) return entered.slice(0, 12);
  const displayed = maskAadhaarEntry(previous);
  let start = 0;
  while (start < displayed.length && start < entered.length && displayed[start] === entered[start]) start++;
  let end = displayed.length;
  let enteredEnd = entered.length;
  while (end > start && enteredEnd > start && displayed[end - 1] === entered[enteredEnd - 1]) {
    end--;
    enteredEnd--;
  }
  return (previous.slice(0, start) + entered.slice(start, enteredEnd).replace(/\D/g, '') + previous.slice(end)).slice(0, 12);
}

export function mockIdentityFields(): IdentityFields {
  return readIdentityFields({ fields: {
    fullName: 'Rahul Sharma',
    dateOfBirth: '1995-05-15',
    gender: 'Male',
    fatherName: 'Suresh Sharma',
    residentialAddress: '123 Main Street, Varanasi, UP, 221006',
    panNumber: 'ABCDE1234F',
    aadhaarNumber: 'XXXXXXXX9012'
  } });
}

export function validateIdentityFile(file: Pick<File, 'type' | 'name' | 'size'>): string {
  if (!ALLOWED_FILE_TYPES.includes(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    return 'File type is not supported. Allowed formats: PDF, JPG, PNG.';
  }
  if (file.size === 0) return 'The document is empty. Please choose another file.';
  return file.size > MAX_FILE_SIZE ? 'File size exceeds the 5 MB limit.' : '';
}

export function validateIdentity(type: IdentityType, number: string, file: File | null, consent: boolean): string {
  if (!type) return 'Select Aadhaar or PAN before fetching identity details.';
  if (!consent) return 'Please provide consent before fetching identity details.';
  if (file) return validateIdentityFile(file);
  const valid = type === 'AADHAAR' ? /^[2-9]\d{11}$/.test(number) : /^[A-Z]{5}\d{4}[A-Z]$/.test(number);
  return valid ? '' : `Enter a valid ${type === 'AADHAAR' ? '12-digit Aadhaar' : 'PAN'} number or upload a document.`;
}

export function readIdentityFields(payload: unknown): IdentityFields {
  if (!payload || typeof payload !== 'object' || !('fields' in payload)
    || !payload.fields || typeof payload.fields !== 'object') {
    throw new Error('The identity service returned an invalid response. Please enter your details manually.');
  }
  const fields: IdentityFields = {};
  for (const key of IDENTITY_FIELDS) {
    const value = Reflect.get(payload.fields, key);
    if (typeof value === 'string' && value.trim()) {
      fields[key] = key === 'aadhaarNumber' ? maskAadhaar(value.trim()) : value.trim();
    }
  }
  if (!Object.keys(fields).length) {
    throw new Error('No applicable applicant details were returned. Please enter your details manually.');
  }
  return fields;
}
