import { next, rewrite } from '@vercel/functions';
import { createBetaProxy } from './server/beta-proxy.mjs';

export default createBetaProxy({ settings: process.env, next, rewrite });
