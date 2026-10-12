import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEMO_USER_OTP } from './auth';
import { LoginPage } from './LoginPage';

const fetchMock = vi.fn();
const consentLabel = 'I have read and agree to the Terms & Conditions and Privacy Policy.';

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    }
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    }
  });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('login consent', () => {
  it('starts unchecked and blocks the User OTP step until accepted', () => {
    render(<LoginPage onAuthenticated={vi.fn()} />);

    const consent = screen.getByRole('checkbox', { name: consentLabel });
    expect((consent as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(screen.getByRole('alert').textContent).toContain('Please accept the Terms & Conditions');
    expect(screen.queryByText('Demo OTP')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows the existing User OTP and authenticated login flow after acceptance', async () => {
    const onAuthenticated = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'user-token', role: 'USER' })
    });
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    fireEvent.click(screen.getByRole('checkbox', { name: consentLabel }));
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByText('Demo OTP')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Enter 6-digit OTP'), { target: { value: DEMO_USER_OTP } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login/user', expect.objectContaining({ method: 'POST' }));
  });

  it('blocks OTP verification if consent is withdrawn after requesting the OTP', () => {
    render(<LoginPage onAuthenticated={vi.fn()} />);

    const consent = screen.getByRole('checkbox', { name: consentLabel });
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    fireEvent.click(consent);
    fireEvent.change(screen.getByPlaceholderText('Enter 6-digit OTP'), { target: { value: DEMO_USER_OTP } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    expect(screen.getByRole('alert').textContent).toContain('Please accept the Terms & Conditions');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prevents duplicate authentication requests while OTP verification is pending', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LoginPage onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: consentLabel }));
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    fireEvent.change(screen.getByPlaceholderText('Enter 6-digit OTP'), { target: { value: DEMO_USER_OTP } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verifying...' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Verifying...' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps existing mobile-number validation after consent is accepted', () => {
    render(<LoginPage onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: consentLabel }));
    fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(screen.getByRole('alert').textContent).toContain('valid 10-digit mobile number');
    expect(screen.queryByText('Demo OTP')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires separate Admin consent and preserves the existing admin endpoint', async () => {
    const onAuthenticated = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'admin-token', role: 'ADMIN' })
    });
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    fireEvent.click(screen.getByRole('button', { name: /Login as Admin/ }));
    const consent = screen.getByRole('checkbox', { name: consentLabel });
    expect((consent as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert').textContent).toContain('Please accept the Terms & Conditions');
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(consent);
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login/admin', expect.objectContaining({ method: 'POST' }));
  });

  it('opens the Terms and Privacy documents in a closable dialog', () => {
    render(<LoginPage onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole('link', { name: 'Terms & Conditions' }));
    expect(screen.getByRole('dialog', { name: 'Terms & Conditions' })).toBeTruthy();
    expect(screen.getByText(/not legal advice or an approved bank policy/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close Terms & Conditions' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Privacy Policy' }));
    expect(screen.getByRole('dialog', { name: 'Privacy Policy' })).toBeTruthy();
  });

  it('keeps User and Admin consent independent when switching roles', () => {
    render(<LoginPage onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: consentLabel }));
    fireEvent.click(screen.getByRole('button', { name: /Login as Admin/ }));
    expect((screen.getByRole('checkbox', { name: consentLabel }) as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Login as User/ }));
    expect((screen.getByRole('checkbox', { name: consentLabel }) as HTMLInputElement).checked).toBe(true);
  });
});