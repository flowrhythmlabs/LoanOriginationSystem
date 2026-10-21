import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canUseLocalCreditFallback, creditServiceError, CreditServiceUnavailableError, withDevelopmentTimeout } from '../src/creditDevelopment.ts';

test('fallback is development-only and limited to unavailable services', () => {
  for (const error of [new TypeError('Failed to fetch'), new CreditServiceUnavailableError('Timed out'), creditServiceError(404, 'Missing'), creditServiceError(503, 'Unavailable')]) {
    assert.equal(canUseLocalCreditFallback(error, true), true);
    assert.equal(canUseLocalCreditFallback(error, false), false);
  }
  for (const status of [400, 401, 403, 409, 422]) {
    assert.equal(canUseLocalCreditFallback(creditServiceError(status, 'Request rejected'), true), false);
  }
  assert.equal(canUseLocalCreditFallback(new Error('KYC failed'), true), false);
});

test('successful service results pass through unchanged', async () => {
  const result = { id: 1001 };
  assert.equal(await withDevelopmentTimeout(async () => result, true), result);
});

test('stalled requests time out and receive an abort signal', async () => {
  let signal;
  await assert.rejects(withDevelopmentTimeout(async requestSignal => {
    signal = requestSignal;
    return new Promise(() => {});
  }, true, 10), CreditServiceUnavailableError);
  assert.equal(signal.aborted, true);
});

test('the timeout includes response-body parsing', async () => {
  await assert.rejects(withDevelopmentTimeout(async () => {
    const response = { json: () => new Promise(() => {}) };
    return response.json();
  }, true, 10), CreditServiceUnavailableError);
});

test('production does not impose a development timeout', async () => {
  const result = await withDevelopmentTimeout(signal => new Promise(resolve => {
    setTimeout(() => resolve({ value: 720, aborted: signal.aborted }), 20);
  }), false, 1);
  assert.deepEqual(result, { value: 720, aborted: false });
});

test('request failures preserve their original error', async () => {
  const error = creditServiceError(403, 'Forbidden');
  await assert.rejects(withDevelopmentTimeout(async () => { throw error; }, true), candidate => candidate === error);
});
