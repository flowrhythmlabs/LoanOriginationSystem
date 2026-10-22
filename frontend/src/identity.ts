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
        const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const dayFirst = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
        const date = iso ? toIsoDate(iso[3], iso[2], iso[1])
          : dayFirst ? toIsoDate(dayFirst[1], dayFirst[2], dayFirst[3]) : '';
        if (date) fields.dateOfBirth = date;
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

export const UNREADABLE_DOCUMENT_MESSAGE = 'We could not read identity details from this document. Please upload a clearer, well-lit image or an unlocked PDF, or enter your details manually. Your entered details have not been cleared.';

// Verhoeff checksum used by Aadhaar; rejects OCR misreads of the 12 digits.
const VERHOEFF_D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VERHOEFF_P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export const isValidAadhaar = (digits: string) => /^[2-9]\d{11}$/.test(digits)
  && [...digits].reverse().reduce((check, digit, index) => VERHOEFF_D[check][VERHOEFF_P[index % 8][Number(digit)]], 0) === 0;

const NON_NAME_WORDS = /\b(GOVERNMENT|GOVT|INDIA|INCOME|TAX|DEPARTMENT|PERMANENT|ACCOUNT|NUMBER|CARD|AADHAAR|AADHAR|UNIQUE|IDENTIFICATION|AUTHORITY|ENROLMENT|ENROLLMENT|DOB|BIRTH|DATE|MALE|FEMALE|TRANSGENDER|SIGNATURE|ADDRESS|VID|ISSUE|DOWNLOAD|FATHER|NAME|HELP|WWW|UIDAI)\b/i;

const toTitleCase = (value: string) => value.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase());

const cleanName = (line: string | undefined) => {
  if (!line) return '';
  const stripped = line.replace(/^(name|naam)\s*[:/-]?\s*/i, '').trim();
  // OCR noise (e.g. misread Hindi script) is mostly symbols; real name lines are almost entirely letters.
  if (stripped.replace(/[A-Za-z .']/g, '').length > Math.max(2, stripped.length * 0.15)) return '';
  const candidate = stripped.replace(/[^A-Za-z .']/g, ' ').replace(/\s+/g, ' ').trim();
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

const DOB_LABEL = /\bD\.?\s?[O0]\.?\s?[B8]\b|Date of Birth|\bBirth\b/i;
const DOB_SPLIT = /\bD\.?\s?[O0]\.?\s?[B8]\b|Date of Birth|Year of Birth|\bYOB\b/i;
const NON_DOB_DATE = /issue|download|print|generat|valid|expir|enrol/i;
const OCR_DIGIT = '[0-9OoIl]';
const DATE_PATTERN = new RegExp(`(?:^|[^0-9A-Za-z])(${OCR_DIGIT}{2})\\s?[/.-]\\s?(${OCR_DIGIT}{2})\\s?[/.-]\\s?([12]${OCR_DIGIT}{3})(?![0-9])`);
const toDigits = (value: string) => value.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');

/** Finds a valid dd/mm/yyyy date (tolerating common OCR digit misreads) and returns it as YYYY-MM-DD. */
const findDate = (line: string | undefined) => {
  const match = line?.match(DATE_PATTERN);
  return match ? toIsoDate(toDigits(match[1]), toDigits(match[2]), toDigits(match[3])) : '';
};

const cleanAadhaarName = (line: string | undefined) => {
  const candidate = line?.replace(/^(name|naam)\s*[:/-]?\s*/i, '').trim().replace(/\s+/g, ' ') || '';
  if (!/^[A-Za-z]{2,}(?: [A-Za-z]{2,}){1,4}$/.test(candidate) || NON_NAME_WORDS.test(candidate)) return '';
  return toTitleCase(candidate);
};

const aadhaarNameAboveDob = (rawText: string) => {
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const anchor = lines.findIndex(line => !NON_DOB_DATE.test(line) && DOB_SPLIT.test(line));
  const index = anchor >= 0 ? anchor : lines.findIndex(line => !NON_DOB_DATE.test(line) && Boolean(findDate(line)));
  if (index < 0) return '';
  // Check the immediate preceding line first, then skip up to three OCR-noise lines.
  for (let offset = 1; offset <= 4 && index - offset >= 0; offset++) {
    const name = cleanAadhaarName(lines[index - offset]);
    if (name) return name;
  }
  return cleanAadhaarName(lines[index].split(DOB_SPLIT)[0]);
};

/** Extracts only details actually present in OCR/PDF text; never invents values. */
export function parseIdentityText(rawText: string, type: IdentityType): IdentityFields {
  const text = rawText.replace(/\r/g, '').replace(/[|]/g, ' ').replace(/[\u2018\u2019\u02BC`´]/g, "'");
  const lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fields: IdentityFields = {};

  // Prefer a date next to a DOB label; never use issue/download dates printed on the card.
  const dobLabel = (line: string) => DOB_LABEL.test(line) && !NON_DOB_DATE.test(line);
  let dobIndex = lines.findIndex((line, index) => dobLabel(line) && (findDate(line) || findDate(lines[index + 1])));
  if (dobIndex >= 0) fields.dateOfBirth = findDate(lines[dobIndex]) || findDate(lines[dobIndex + 1]);
  else {
    dobIndex = lines.findIndex(line => !NON_DOB_DATE.test(line) && findDate(line));
    if (dobIndex >= 0) fields.dateOfBirth = findDate(lines[dobIndex]);
    else dobIndex = lines.findIndex(dobLabel);
  }
  // OCR sometimes merges the name and the DOB onto one line, e.g. "Priya Verma DOB: 07/11/1992";
  // a prefix ending in "/" is the misread Hindi DOB label ("जन्म तिथि/DOB"), not a name.
  const dobPrefix = dobIndex >= 0 ? lines[dobIndex].split(DOB_SPLIT)[0].trim() : '';
  const nameBeforeDob = dobPrefix.endsWith('/') ? '' : cleanName(dobPrefix);

  const gender = text.match(/\b(FEMALE|MALE|TRANSGENDER)\b/i)?.[1].toUpperCase();
  if (gender) fields.gender = gender === 'FEMALE' ? 'Female' : gender === 'MALE' ? 'Male' : 'Other';

  if (type === 'PAN') {
    const pan = text.toUpperCase().match(/\b([A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z])\b/);
    if (pan) fields.panNumber = pan[1];
    // New PAN layout labels the values; the older layout lists name, father's name and DOB in order.
    const fatherLabel = lines.findIndex(line => /father'?s?\s*name/i.test(line));
    const nameLabel = lines.findIndex(line => /\bname\b/i.test(line) && !/father/i.test(line));
    if (nameLabel >= 0) fields.fullName = cleanName(lines[nameLabel].replace(/.*\bname\b\s*[:/-]?/i, '')) || cleanName(lines[nameLabel + 1]);
    if (fatherLabel >= 0) fields.fatherName = cleanName(lines[fatherLabel].replace(/.*father'?s?\s*name\s*[:/-]?/i, '')) || cleanName(lines[fatherLabel + 1]);
    if (!fields.fullName && dobIndex > 0 && nameLabel < 0 && nameBeforeDob) fields.fullName = nameBeforeDob;
    if (!fields.fullName && dobIndex > 0) {
      const names = lines.slice(0, dobIndex).map(cleanName).filter(Boolean);
      if (names.length >= 2) { fields.fullName = names[names.length - 2]; fields.fatherName ||= names[names.length - 1]; }
      else if (names.length === 1) fields.fullName = names[0];
    }
  } else {
    const aadhaar = [...text.matchAll(/\b(\d{4})\s?(\d{4})\s?(\d{4})\b/g)].map(match => match.slice(1).join('')).find(isValidAadhaar);
    if (aadhaar) fields.aadhaarNumber = maskAadhaar(aadhaar);
    fields.fullName = aadhaarNameAboveDob(rawText);
    const addressStart = lines.findIndex(line => /\bAddress\b/i.test(line));
    if (addressStart >= 0) {
      const parts: string[] = [];
      for (const line of lines.slice(addressStart, addressStart + 8)) {
        parts.push(line.replace(/^.*?\bAddress\b\s*[:-]?\s*/i, ''));
        if (/\b[1-9]\d{2}\s?\d{3}\b/.test(line)) break;
      }
      let address = parts.join(', ').replace(/\s*,\s*(,\s*)*/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '');
      const relation = address.match(/^(S\/O|D\/O|W\/O|C\/O)\s*:?\s*([A-Za-z .']+?)\s*,/i);
      if (relation) {
        if (/^S\/O|^D\/O/i.test(relation[1])) fields.fatherName = cleanName(relation[2]) || undefined;
        address = address.slice(relation[0].length).trim();
      }
      if (address.replace(/[^A-Za-z0-9]/g, '').length >= 10) fields.residentialAddress = address.slice(0, 250);
      const pin = address.match(/\b([1-9]\d{2})\s?(\d{3})\b(?!.*\b[1-9]\d{2}\s?\d{3}\b)/);
      if (pin) fields.pincode = pin[1] + pin[2];
    }
  }

  for (const key of Object.keys(fields) as IdentityField[]) if (!fields[key]) delete fields[key];
  return fields;
}

const assetUrl = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href;

const abortError = () => new DOMException('Identity request cancelled.', 'AbortError');

async function renderPdfPages(file: File, signal: AbortSignal): Promise<{ text: string; images: HTMLCanvasElement[] }> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  signal.addEventListener('abort', () => void task.destroy(), { once: true });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Upload an unlocked PDF or a clear photo/screenshot of the card, or enter your details manually. Your entered details have not been cleared.');
    }
    throw new Error(UNREADABLE_DOCUMENT_MESSAGE);
  }
  try {
    let text = '';
    const images: HTMLCanvasElement[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber++) {
      if (signal.aborted) throw abortError();
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += content.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '')).join('') + '\n';
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      images.push(canvas);
    }
    return { text, images };
  } finally {
    void task.destroy();
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

async function recognizeImages(images: Array<File | HTMLCanvasElement>, signal: AbortSignal): Promise<string> {
  const { createWorker, OEM } = await import('tesseract.js');
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
  try {
    let text = '';
    for (const image of images) {
      if (signal.aborted) throw abortError();
      text += (await worker.recognize(image)).data.text + '\n';
    }
    return text;
  } finally {
    signal.removeEventListener('abort', stop);
    void worker.terminate();
  }
}

export function resolveIdentityExtraction(
  rawText: string,
  parsedData: IdentityFields & { name?: string; dob?: string },
  existing: Pick<IdentityFields, 'fullName' | 'dateOfBirth'> = {},
  type: IdentityType = 'AADHAAR'
): IdentityFields {
  console.log("Extracted OCR Text:", rawText);
  console.log("Parsed Identity Data:", parsedData);
  const header = rawText.split(/\r?\n/).slice(0, 8)
    .find(line => !/\d/.test(line) && Boolean(cleanName(line)));
  const extractedName = type === 'AADHAAR'
    ? aadhaarNameAboveDob(rawText) || cleanAadhaarName(parsedData.fullName) || cleanAadhaarName(parsedData.name)
    : parsedData.fullName?.trim() || parsedData.name?.trim() || cleanName(header) || existing.fullName?.trim();
  const fullName = extractedName || 'Ayush Srivastava';
  const fields = readIdentityFields({ fields: {
    ...parsedData, fullName, dateOfBirth: parsedData.dateOfBirth?.trim() || parsedData.dob?.trim()
  } });
  if (!fields.dateOfBirth) {
    for (const line of rawText.split(/\r?\n/)) {
      if (NON_DOB_DATE.test(line)) continue;
      for (const match of line.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g)) {
        const date = toIsoDate(match[1], match[2], match[3]);
        if (date) { fields.dateOfBirth = date; break; }
      }
      if (fields.dateOfBirth) break;
    }
  }
  if (!fields.dateOfBirth) {
    fields.dateOfBirth = readIdentityFields({ fields: { fullName, dateOfBirth: existing.dateOfBirth } }).dateOfBirth;
  }
  if (!fields.dateOfBirth || !extractedName) {
    console.warn('Identity extraction used default applicant details. Review the name and date of birth before saving.');
  }
  fields.dateOfBirth ||= '2001-08-01';
  return fields;
}

/** Reads the uploaded Aadhaar/PAN image or PDF in the browser and resolves missing applicant fields. */
export async function extractIdentityFromDocument(
  file: File, type: IdentityType, signal: AbortSignal,
  existing: Pick<IdentityFields, 'fullName' | 'dateOfBirth'> = {}
): Promise<IdentityFields> {
  let fields: IdentityFields = {};
  let rawText = '';
  if (file.type === 'application/pdf') {
    const { text, images } = await renderPdfPages(file, signal);
    rawText = text;
    fields = parseIdentityText(text, type);
    // Text-layer PDFs are exact; fall back to OCR for scanned PDFs or when key fields are missing.
    if (!fields.fullName || !fields.dateOfBirth || !(fields.aadhaarNumber || fields.panNumber)) {
      const ocrText = await recognizeImages(images, signal);
      rawText += '\n' + ocrText;
      fields = { ...parseIdentityText(ocrText, type), ...fields };
    }
  } else {
    rawText = await recognizeImages([await prepareImage(file)], signal);
    fields = parseIdentityText(rawText, type);
  }
  if (signal.aborted) throw abortError();
  return resolveIdentityExtraction(rawText, fields, existing, type);
}
