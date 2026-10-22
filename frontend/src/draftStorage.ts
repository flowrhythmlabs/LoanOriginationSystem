const DRAFT_STORAGE_VERSION = 1;

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
  } catch {
    // Storage may be full or unavailable (e.g. private mode); the backend draft still applies.
  }
};

export const clearLoanDraft = (mobile: string | undefined) => {
  if (!mobile) return;
  try { localStorage.removeItem(loanDraftKey(mobile)); } catch { /* ignore */ }
};
