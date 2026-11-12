import './env.mjs';

export const HOST = (process.env.HOST || '127.0.0.1').trim();
export const PORT = Number(process.env.PORT || 4317);
export const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost'];
// Writes are off unless the operator opts in via .env. The model cannot change this.
export const WRITES_ENABLED = /^(1|true|yes|on)$/i.test((process.env.CHAT2GIT_ALLOW_WRITES || '').trim());
