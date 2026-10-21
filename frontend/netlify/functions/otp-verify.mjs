import { verifyOtp } from './lib/otp.mjs';

export default (req) => verifyOtp(req);
export const config = { path: '/api/auth/login/user' };
