import { requestOtp } from './lib/otp.mjs';

export default (req) => requestOtp(req);
export const config = { path: '/api/auth/otp/request' };
