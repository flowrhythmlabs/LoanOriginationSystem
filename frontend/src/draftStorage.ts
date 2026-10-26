import type { IdentityFields } from './identity';

const DRAFT_STORAGE_VERSION = 1;

export type IdentityDocumentMetadata = {
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: number;
  fetchedFields: IdentityFields;
};

export const readIdentityDocument = (value: unknown): IdentityDocumentMetadata | null => {
  if (value == null || value === '') return null;
  const data: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (data === null) return null;
  if (typeof data !== 'object') {
    throw new Error('Saved identity document metadata is invalid. Please upload the document again.');
  }
  // Accept drafts written before document fields and upload time were stored together.
  const fileName = 'fileName' in data ? data.fileName : 'name' in data ? data.name : undefined;
  const fileSize = 'fileSize' in data ? data.fileSize : 'size' in data ? data.size : undefined;
  const fileType = 'fileType' in data ? data.fileType : 'type' in data ? data.type : undefined;
  const uploadedAt = 'uploadedAt' in data ? data.uploadedAt : 'lastModified' in data ? data.lastModified : undefined;
  if (typeof fileName !== 'string' || !fileName.trim()
    || typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0
    || typeof fileType !== 'string' || !['application/pdf', 'image/jpeg', 'image/png'].includes(fileType)
    || typeof uploadedAt !== 'number' || !Number.isFinite(uploadedAt) || uploadedAt < 0) {
    throw new Error('Saved identity document metadata is invalid. Please upload the document again.');
  }
  const fetchedFields: IdentityFields = {};
  if ('fetchedFields' in data) {
    if (!data.fetchedFields || typeof data.fetchedFields !== 'object' || Array.isArray(data.fetchedFields)
      || Object.values(data.fetchedFields).some(value => typeof value !== 'string')) {
      throw new Error('Saved identity document fields are invalid. Please upload the document again.');
    }
    Object.assign(fetchedFields, data.fetchedFields);
  }
  return { fileName, fileSize, fileType, uploadedAt, fetchedFields };
};

export const loanDraftKey = (mobile: string) => `loan_draft_${mobile}`;

export type StoredLoanDraft<T> = T & { version: number; savedAt: string; currentStep: number };

export const readLoanDraft = <T extends object>(mobile: string | undefined): StoredLoanDraft<T> | null => {
  if (!mobile) return null;
  try {
    const raw = localStorage.getItem(loanDraftKey(mobile));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLoanDraft<T>;
    if (!parsed || parsed.version !== DRAFT_STORAGE_VERSION || !Number.isInteger(parsed.currentStep)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeLoanDraft = <T extends object>(mobile: string | undefined, draft: T & { currentStep: number }) => {
  if (!mobile) return;
  try {
    localStorage.setItem(loanDraftKey(mobile), JSON.stringify({ ...draft, version: DRAFT_STORAGE_VERSION, savedAt: new Date().toISOString() }));
  } catch (error) {
    console.error('Unable to save the local loan draft.', error);
    return 'Your draft could not be saved on this device. Check browser storage settings and use Save Draft to retry saving to the server.';
  }
  return '';
};

export const clearLoanDraft = (mobile: string | undefined) => {
  if (!mobile) return;
  try { localStorage.removeItem(loanDraftKey(mobile)); } catch { /* ignore */ }
};
