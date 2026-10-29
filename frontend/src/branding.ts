export type PublicBranding = {
  institutionName: string;
  shortName: string;
  tagline: string;
  applicationName: string;
  publicBaseUrl: string;
};

export const DEFAULT_BRANDING: PublicBranding = {
  institutionName: 'FinEdge NBFC',
  shortName: 'FinEdge',
  tagline: 'Your Growth. Our Support.',
  applicationName: 'FinEdge Loan Origination System',
  publicBaseUrl: 'http://localhost:5173'
};

let brandingRequest: Promise<PublicBranding> | undefined;

function parseBranding(value: unknown): PublicBranding {
  if (!value || typeof value !== 'object') {
    throw new Error('Public branding response is not an object.');
  }

  const config = value as Record<string, unknown>;
  const requiredString = (field: keyof PublicBranding): string => {
    const fieldValue = config[field];
    if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
      throw new Error(`Public branding response is missing ${field}.`);
    }
    return fieldValue;
  };

  return {
    institutionName: requiredString('institutionName'),
    shortName: requiredString('shortName'),
    tagline: requiredString('tagline'),
    applicationName: requiredString('applicationName'),
    publicBaseUrl: requiredString('publicBaseUrl')
  };
}

export function loadBranding(): Promise<PublicBranding> {
  if (!brandingRequest) {
    brandingRequest = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch('/api/public/config', { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Public branding request failed (${response.status}).`);
        }
        return parseBranding(await response.json());
      } catch (error) {
        console.warn('Unable to load public LOS branding; using the default branding.', error);
        return DEFAULT_BRANDING;
      } finally {
        window.clearTimeout(timeout);
      }
    })();
  }

  return brandingRequest;
}
