export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export type IdentityType = '' | 'AADHAAR' | 'PAN';

export const IDENTITY_FIELDS = [
  'fullName', 'dateOfBirth', 'panNumber', 'mobileNumber', 'email', 'workEmail',
  'residentialAddress', 'city', 'state', 'pincode',
  'gender', 'fatherName', 'motherName', 'spouseName', 'nationality',
  'residentialStatus', 'maritalStatus', 'education', 'alternateMobile',
  'permanentAddress', 'aadhaarNumber', 'yearOfBirth'
] as const;
export type IdentityField = typeof IDENTITY_FIELDS[number];
export type IdentityFields = Partial<Record<IdentityField, string>>;

export type IdentityLookupRecords = Record<'PAN' | 'AADHAAR', Readonly<Record<string, IdentityFields>>>;

export function lookupIdentityNumber(
  type: IdentityType, number: string, records: IdentityLookupRecords = { PAN: {}, AADHAAR: {} }
): IdentityFields {
  const error = validateIdentity(type, number, null, true);
  if (error) throw new Error(error);
  const record = type ? records[type][number] : undefined;
  return readIdentityFields({ fields: {
    ...record,
    ...(type === 'PAN' ? { panNumber: number } : { aadhaarNumber: number })
  } });
}

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
    let value = Reflect.get(payload.fields, key);
    if ((typeof value !== 'string' || !value.trim()) && (key === 'fullName' || key === 'dateOfBirth')) {
      value = Reflect.get(payload.fields, key === 'fullName' ? 'name' : 'dob');
    }
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      if (key === 'dateOfBirth') {
        const iso = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
        const dayFirst = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
        const date = iso ? toIsoDate(iso[3], iso[2], iso[1])
          : dayFirst ? toIsoDate(dayFirst[1], dayFirst[2], dayFirst[3]) : '';
        if (date) fields.dateOfBirth = date;
      } else if (key === 'yearOfBirth') {
        if (/^\d{4}$/.test(trimmed) && Number(trimmed) >= 1900 && Number(trimmed) <= new Date().getFullYear()) fields.yearOfBirth = trimmed;
      } else {
        fields[key] = key === 'aadhaarNumber' ? maskAadhaar(trimmed) : trimmed;
      }
    }
  }
  if (!Object.keys(fields).length) {
    throw new Error('No applicable applicant details were returned. Please enter your details manually.');
  }
  return fields;
}

export const UNREADABLE_DOCUMENT_MESSAGE = 'We could not read identity details from this document. Please upload a clearer, well-lit image or an unlocked PDF, or enter your details manually.';

// Verhoeff checksum used by Aadhaar; rejects OCR misreads of the 12 digits.
const VERHOEFF_D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VERHOEFF_P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export const isValidAadhaar = (digits: string) => /^[2-9]\d{11}$/.test(digits)
  && [...digits].reverse().reduce((check, digit, index) => VERHOEFF_D[check][VERHOEFF_P[index % 8][Number(digit)]], 0) === 0;

const NON_NAME_WORDS = /\b(GOVERNMENT|GOVT|INDIA|BHARAT|SARKAR|INCOME|TAX|DEPARTMENT|PERMANENT|ACCOUNT|NUMBER|CARD|AADHAAR|AADHAR|UNIQUE|IDENTIFICATION|AUTHORITY|ENROLMENT|ENROLLMENT|DOB|YOB|BIRTH|DATE|MALE|FEMALE|TRANSGENDER|SIGNATURE|ADDRESS|VID|ISSUE|DOWNLOAD|FATHER|MOTHER|GUARDIAN|NAME|HELP|HELPDESK|TAPSCANNER|SCANNED|WWW|UIDAI|TO|CARE|OF)\b/i;

export const normalizeIdentityText = (text: string) => text.normalize('NFKC')
  .replace(/\r\n?/g, '\n')
  .replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
  .replace(/[|]/g, ' ')
  .replace(/[\u2018\u2019\u02bc`´]/g, "'")
  .split('\n').map(line => line.replace(/[^\S\n]+/g, ' ').trim()).join('\n');

const toTitleCase = (value: string) => value.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase());

const cleanName = (line: string | undefined) => {
  if (!line) return '';
  if (line.includes('[unreadable]')) return '';
  if (/\b[SDWC]\s*\/\s*O\b|Care\s+of\b/i.test(line)) return '';
  const stripped = line.replace(/[\u0900-\u0dff]+/g, ' ').replace(/^(name|naam)\s*[:/-]?\s*/i, '')
    .replace(/^[\s:/*~]+|[\s:/*~]+$/g, '').trim();
  // OCR noise (e.g. misread Hindi script) is mostly symbols; real name lines are almost entirely letters.
  if (/\d/.test(stripped) || stripped.replace(/[A-Za-z .'-]/g, '').length > Math.max(2, stripped.length * 0.15)) return '';
  const candidate = stripped.replace(/[^A-Za-z .'-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = candidate.split(' ').filter(word => word.replace(/\./g, '').length > 0);
  if (words.length < 1 || words.length > 5 || candidate.replace(/[ .']/g, '').length < 3 || NON_NAME_WORDS.test(candidate)) return '';
  if (!words.some(word => word.replace(/[.']/g, '').length >= 2)) return '';
  return toTitleCase(candidate);
};

const toIsoDate = (day: string, month: string, year: string) => {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const valid = date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
  return valid && Number(year) >= 1900 && date.getTime() <= Date.now() ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '';
};

const DOB_LABEL = /\bD\.?\s*[O0]\.?\s*[B8]\.?\b|Date\s+of\s+Birth|\bBirth\b/i;
const YEAR_OF_BIRTH_LABEL = /Year\s+of\s+Birth|\bY\.?\s*O\.?\s*B\b/i;
const DOB_SPLIT = /Year\s+of\s+Birth|\bY\.?\s*O\.?\s*B\b|\bD\.?\s*[O0]\.?\s*[B8]\.?\b|Date\s+of\s+Birth|\bBirth\b/i;
const NON_DOB_DATE = /issue|download|print|generat|valid|expir|enrol/i;
const OCR_DIGIT = '[0-9OoIl]';
const DATE_PATTERN = new RegExp(`(?:^|[^0-9A-Za-z])(${OCR_DIGIT}{2})\\s?[/.-]\\s?(${OCR_DIGIT}{2})\\s?[/.-]\\s?([12]${OCR_DIGIT}{3})(?![0-9])`);
const ISO_DATE_PATTERN = new RegExp(`(?:^|[^0-9A-Za-z])([12]${OCR_DIGIT}{3})\\s?[-/]\\s?(${OCR_DIGIT}{2})\\s?[-/]\\s?(${OCR_DIGIT}{2})(?![0-9])`);
const toDigits = (value: string) => value.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');

/** Normalizes day-first and ISO dates, tolerating common OCR digit misreads. */
const findDate = (line: string | undefined) => {
  const iso = line?.match(ISO_DATE_PATTERN);
  if (iso) return toIsoDate(toDigits(iso[3]), toDigits(iso[2]), toDigits(iso[1]));
  const match = line?.match(DATE_PATTERN);
  return match ? toIsoDate(toDigits(match[1]), toDigits(match[2]), toDigits(match[3])) : '';
};

const cleanAadhaarName = (line: string | undefined) => {
  return cleanName(line);
};

const aadhaarNameAboveDob = (rawText: string, preferredIndex = -1) => {
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const anchor = lines.findIndex(line => !NON_DOB_DATE.test(line) && DOB_SPLIT.test(line));
  const index = preferredIndex >= 0 ? preferredIndex : anchor >= 0 ? anchor : lines.findIndex(line => !NON_DOB_DATE.test(line) && Boolean(findDate(line)));
  if (index < 0) return '';
  const sameLine = lines[index].split(DOB_SPLIT)[0].trim();
  if (!sameLine.endsWith('/')) {
    const name = cleanAadhaarName(sameLine);
    if (name) return name;
  }
  for (let offset = 1; offset <= 8 && index - offset >= 0; offset++) {
    const name = cleanAadhaarName(lines[index - offset]);
    if (name) return name;
  }
  return '';
};

/** Extracts only details actually present in OCR/PDF text; never invents values. */
export function parseIdentityText(rawText: string, type: IdentityType): IdentityFields {
  const text = normalizeIdentityText(rawText);
  const lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fields: IdentityFields = {};
  const labelledName = (label: RegExp) => {
    for (let index = 0; index < lines.length; index++) {
      if (!label.test(lines[index])) continue;
      const value = cleanName(lines[index].replace(label, ''));
      if (value) return value;
      for (const nextLine of lines.slice(index + 1, index + 4)) {
        const candidate = cleanName(nextLine);
        if (candidate) return candidate;
        if (/[A-Za-z0-9]/.test(nextLine)) break;
      }
    }
    return '';
  };

  // Prefer a date next to a DOB label; never use issue/download dates printed on the card.
  const dobLabel = (line: string) => DOB_LABEL.test(line) && !YEAR_OF_BIRTH_LABEL.test(line) && !NON_DOB_DATE.test(line);
  const labelledDate = (index: number) => {
    const line = lines[index];
    const sameLine = findDate(line);
    if (sameLine) return sameLine;
    const label = line.match(DOB_LABEL);
    const suffix = label ? line.slice((label.index || 0) + label[0].length) : line;
    const nextLine = lines[index + 1];
    return !suffix.replace(/[\s:./-]/g, '') && nextLine && !NON_DOB_DATE.test(nextLine) ? findDate(nextLine) : '';
  };
  let dobIndex = lines.findIndex((line, index) => dobLabel(line) && labelledDate(index));
  if (dobIndex >= 0) fields.dateOfBirth = labelledDate(dobIndex);
  else if (!lines.some(dobLabel)) {
    const standaloneDates = lines.map((line, index) => ({ line, index }))
      .filter(({ line }) => !NON_DOB_DATE.test(line) && Boolean(findDate(line))
        && /^[\dOoIl\s/.-]+$/.test(line.replace(/[\u0900-\u0dff]/g, '').replace(/\b(?:FEMALE|MALE|TRANSGENDER)\b/ig, '').trim()));
    dobIndex = standaloneDates.length === 1 ? standaloneDates[0].index : -1;
    if (dobIndex >= 0) fields.dateOfBirth = findDate(lines[dobIndex]);
  } else dobIndex = lines.findIndex(dobLabel);
  if (!fields.dateOfBirth) {
    for (let index = 0; index < lines.length; index++) {
      if (!YEAR_OF_BIRTH_LABEL.test(lines[index]) || NON_DOB_DATE.test(lines[index])) continue;
      const suffix = lines[index].split(YEAR_OF_BIRTH_LABEL)[1] || '';
      const year = suffix.match(/\b((?:19|20)\d{2})\b/)?.[1]
        || (!suffix.replace(/[\s:/.-]/g, '') ? lines[index + 1]?.match(/^((?:19|20)\d{2})$/)?.[1] : undefined);
      if (year && Number(year) <= new Date().getFullYear()) {
        fields.yearOfBirth = year;
        if (dobIndex < 0) dobIndex = index;
        break;
      }
    }
  }
  // OCR sometimes merges the name and the DOB onto one line, e.g. "Priya Verma DOB: 07/11/1992";
  // a prefix ending in "/" is the misread Hindi DOB label ("जन्म तिथि/DOB"), not a name.
  const dobPrefix = dobIndex >= 0 ? lines[dobIndex].split(DOB_SPLIT)[0].trim() : '';
  const nameBeforeDob = dobPrefix.endsWith('/') ? '' : cleanName(dobPrefix);

  const gender = text.match(/\b(FEMALE|MALE|TRANSGENDER)\b/i)?.[1].toUpperCase();
  if (gender) fields.gender = gender === 'FEMALE' ? 'Female' : gender === 'MALE' ? 'Male' : 'Other';

  if (type === 'PAN') {
    const pan = text.toUpperCase().match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
    if (pan) fields.panNumber = pan[1];
    // New PAN layout labels the values; the older layout lists name, father's name and DOB in order.
    const fatherLabel = lines.findIndex(line => /(?:father'?s?|guardian)(?:\s*name)?\b/i.test(line));
    const nameLabel = lines.findIndex(line => /\bname\b/i.test(line) && !/father|guardian/i.test(line));
    if (nameLabel >= 0) fields.fullName = labelledName(/^(?:(?!father|guardian).)*\bname\b\s*[:/-]?\s*/i);
    if (fatherLabel >= 0) fields.fatherName = labelledName(/^.*\b(?:father'?s?|guardian)(?:\s*name)?\s*[:/-]?\s*/i);
    if (!fields.fullName && dobIndex > 0 && nameLabel < 0 && nameBeforeDob) fields.fullName = nameBeforeDob;
    if (!fields.fullName && dobIndex > 0 && nameLabel < 0) {
      const names = lines.slice(0, dobIndex).map(cleanName).filter(Boolean);
      if (names.length >= 2) { fields.fullName = names[names.length - 2]; fields.fatherName ||= names[names.length - 1]; }
      else if (names.length === 1) fields.fullName = names[0];
    }
    if (!fields.fullName && nameLabel < 0) {
      const header = lines.findIndex(line => /INCOME TAX DEPARTMENT/i.test(line));
      if (header >= 0) fields.fullName = lines.slice(header + 1, header + 5).map(cleanName).find(Boolean);
    }
  } else {
    const aadhaar = [...text.matchAll(/\b(\d{4})\s*(\d{4})\s*(\d{4})\b/g)].map(match => match.slice(1).join('')).find(isValidAadhaar);
    const masked = text.match(/(?:^|[^A-Za-z0-9])(?:[Xx*•]{4}\s*){2}(\d{4})(?!\d)/);
    if (aadhaar) fields.aadhaarNumber = maskAadhaar(aadhaar);
    else if (masked) fields.aadhaarNumber = `XXXXXXXX${masked[1]}`;
    const nameLabel = lines.findIndex(line => /^(?:name|naam)\b/i.test(line));
    const toLabel = lines.findIndex(line => /^To\s*[:/-]?(?:\s|$)/i.test(line));
    fields.fullName = nameLabel >= 0 ? labelledName(/^(?:name|naam)\b\s*[:/-]?\s*/i)
      : toLabel >= 0 ? labelledName(/^To\s*[:/-]?\s*/i) : '';
    if (!fields.fullName && nameLabel < 0) fields.fullName = aadhaarNameAboveDob(text, dobIndex);
    if (!fields.fullName && nameLabel < 0 && toLabel < 0) {
      const header = lines.findIndex(line => /GOVERNMENT OF INDIA|BHARAT SARKAR/i.test(line));
      if (header >= 0) fields.fullName = lines.slice(header + 1, dobIndex > header ? dobIndex : header + 8).map(cleanAadhaarName)
        .find(name => Boolean(name) && name.split(/\s+/).length >= 2 && name.split(/\s+/).length <= 4);
    }
    const fatherLabel = lines.findIndex(line => /\b(?:father(?:'?s)?|guardian)(?:\s*name)?\b/i.test(line));
    if (fatherLabel >= 0) {
      fields.fatherName = labelledName(/^.*\b(?:father(?:'?s)?|guardian)(?:\s*name)?\b\s*[:/-]?\s*/i);
    }
    if (!fields.fatherName) {
      const relationIndex = lines.findIndex(line => /^(?:Address\s*[:/-]?\s*)?(?:[SDWC]\s*\/\s*O\b|Care\s+of\b)/i.test(line));
      if (relationIndex >= 0) {
        const relationName = lines[relationIndex].match(/^(?:Address\s*[:/-]?\s*)?(?:[SDWC]\s*\/\s*O\b|Care\s+of\b)\s*:?\s*([^,\d]*)/i)?.[1];
        fields.fatherName = cleanName(relationName) || cleanName(lines[relationIndex + 1]);
      }
    }
    const addressLabel = lines.findIndex(line => /\bAddress\b/i.test(line));
    const relationStart = lines.findIndex(line => /^(?:[SDWC]\s*\/\s*O\b|Care\s+of\b)/i.test(line));
    const addressStart = addressLabel >= 0 ? addressLabel : relationStart;
    if (addressStart >= 0) {
      const parts: string[] = [];
      for (const line of lines.slice(addressStart)) {
        if (/\b(?:UIDAI|www|help|helpdesk|tapscanner|VID|download|issue|GOVERNMENT|BHARAT)\b|(?:[Xx*]{4}\s*){2}\d{4}|\b\d{4}\s\d{4}\s\d{4}\b/i.test(line)) break;
        const addressLine = line.replace(/^.*?\bAddress\b\s*[:-]?\s*/i, '');
        const pin = addressLine.match(/\b[1-9]\d{2}\s?\d{3}\b/);
        parts.push(pin ? addressLine.slice(0, (pin.index || 0) + pin[0].length) : addressLine);
        if (pin) break;
      }
      let address = parts.join(', ').replace(/\s*,\s*(,\s*)*/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '');
      const relation = address.match(/^(?:[SDWC]\s*\/\s*O|Care\s+of)\s*:?\s*,?\s*([A-Za-z .']+?)\s*,/i);
      if (relation) {
        fields.fatherName ||= cleanName(relation[1]) || undefined;
        address = address.slice(relation[0].length).trim();
      }
      if (!address.includes('[unreadable]') && address.replace(/[^A-Za-z0-9]/g, '').length >= 10) fields.residentialAddress = address;
      const pin = address.match(/\b([1-9]\d{2})\s?(\d{3})\b(?!.*\b[1-9]\d{2}\s?\d{3}\b)/);
      if (pin) fields.pincode = pin[1] + pin[2];
    }
  }

  for (const key of Object.keys(fields) as IdentityField[]) if (!fields[key]) delete fields[key];
  return fields;
}

const assetUrl = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href;

const abortError = () => new DOMException('Identity request cancelled.', 'AbortError');

async function readPdfPages(
  file: File, type: IdentityType, signal: AbortSignal,
  recognize: (image: File | HTMLCanvasElement) => Promise<string>,
  onProgress?: (message: string) => void
): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const stop = () => void task.destroy();
  signal.addEventListener('abort', stop, { once: true });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (signal.aborted) throw abortError();
      onProgress?.(`Reading page ${pageNumber} of ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNumber);
      let canvas: HTMLCanvasElement | undefined;
      try {
        const content = await page.getTextContent();
        let text = '';
        let previous: { x: number; y: number; height: number; ended: boolean } | undefined;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const height = Math.abs(item.height) || Math.hypot(item.transform[2], item.transform[3]) || 1;
          const x = item.transform[4];
          const y = item.transform[5];
          if (previous && !previous.ended) {
            if (Math.abs(y - previous.y) > Math.max(height, previous.height) * 0.4) text += '\n';
            else if (x - previous.x > height * 0.15) text += ' ';
          }
          text += item.str + (item.hasEOL ? '\n' : '');
          previous = { x: x + item.width, y, height, ended: item.hasEOL };
        }
        text = normalizeIdentityText(text);
        pages.push(text);
        const fields = parseIdentityText(text, type);
        const frontComplete = fields.fullName && (fields.dateOfBirth || fields.yearOfBirth)
          && (fields.aadhaarNumber || fields.panNumber);
        const backComplete = type === 'AADHAAR' && fields.residentialAddress && fields.pincode && fields.fatherName;
        if (!frontComplete && !backComplete) {
          if (signal.aborted) throw abortError();
          onProgress?.(`Reading scanned text on page ${pageNumber} of ${pdf.numPages}...`);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(3, 2800 / Math.max(baseViewport.width, baseViewport.height));
          const viewport = page.getViewport({ scale });
          canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, viewport }).promise;
          pages.push(await recognize(canvas));
        }
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        page.cleanup();
      }
    }
    return normalizeIdentityText(pages.join('\n\n'));
  } catch (error) {
    if (signal.aborted) throw abortError();
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Upload an unlocked PDF or a clear photo/screenshot of the card, or enter your details manually.');
    }
    throw error;
  } finally {
    signal.removeEventListener('abort', stop);
    await task.destroy();
  }
}

/** Upscales small photos and converts them to grayscale so OCR can read card-sized text reliably. */
async function prepareImage(file: File): Promise<File | HTMLCanvasElement> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(3, Math.max(1, 2000 / Math.max(bitmap.width, bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.filter = 'grayscale(1) contrast(1.2)';
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    return file;
  }
}

async function createIdentityRecognizer(type: IdentityType, signal: AbortSignal) {
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  if (signal.aborted) throw abortError();
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: assetUrl('tesseract/worker.min.js'),
    corePath: assetUrl('tesseract/core'),
    langPath: assetUrl('tesseract/lang'),
    gzip: true,
    cacheMethod: 'none'
  });
  const stop = () => void worker.terminate();
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) {
    signal.removeEventListener('abort', stop);
    await worker.terminate();
    throw abortError();
  }
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  } catch (error) {
    signal.removeEventListener('abort', stop);
    await worker.terminate();
    throw error;
  }
  const recognizeText = async (image: File | HTMLCanvasElement) => {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const lines = data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines));
    return normalizeIdentityText(lines?.length
      ? lines.map(line => confidentIdentityText(line.text, line.confidence)
        || line.words.map(word => confidentIdentityText(word.text, word.confidence) || '[unreadable]').join(' ')
        || '[unreadable]').join('\n')
      : confidentIdentityText(data.text, data.confidence));
  };
  return {
    recognize: async (image: File | HTMLCanvasElement): Promise<string> => {
      if (signal.aborted) throw abortError();
      const text = await recognizeText(image);
      const fields = parseIdentityText(text, type);
      if ((fields.fullName && (fields.dateOfBirth || fields.yearOfBirth) && (fields.aadhaarNumber || fields.panNumber))
        || (fields.residentialAddress && fields.pincode)) return text;
      if (signal.aborted) throw abortError();
      // Card scans often contain separate text islands around photographs and QR codes.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      try {
        return `${text}\n${await recognizeText(image)}`;
      } finally {
        if (!signal.aborted) await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      }
    },
    terminate: async () => {
      signal.removeEventListener('abort', stop);
      await worker.terminate();
    }
  };
}

export const MIN_IDENTITY_OCR_CONFIDENCE = 60;
export const confidentIdentityText = (text: string, confidence: number) =>
  Number.isFinite(confidence) && confidence >= MIN_IDENTITY_OCR_CONFIDENCE ? text : '';

export function resolveIdentityExtraction(
  rawText: string,
  type: IdentityType = 'AADHAAR'
): IdentityFields {
  const extracted = parseIdentityText(rawText, type);
  if (!Object.keys(extracted).length) {
    throw new Error(UNREADABLE_DOCUMENT_MESSAGE);
  }
  return readIdentityFields({ fields: extracted });
}

/** Reads only the current uploaded Aadhaar/PAN image or PDF in the browser. */
export async function extractIdentityFromDocument(
  file: File, type: IdentityType, signal: AbortSignal, onProgress?: (message: string) => void
): Promise<IdentityFields> {
  let recognizer: Awaited<ReturnType<typeof createIdentityRecognizer>> | undefined;
  const recognize = async (image: File | HTMLCanvasElement) => {
    recognizer ||= await createIdentityRecognizer(type, signal);
    return recognizer.recognize(image);
  };
  try {
    const rawText = file.type === 'application/pdf'
      ? await readPdfPages(file, type, signal, recognize, onProgress)
      : await recognize(await prepareImage(file));
    if (signal.aborted) throw abortError();
    return resolveIdentityExtraction(rawText, type);
  } finally {
    await recognizer?.terminate();
  }
}
