/** Where playwright.config.ts starts the real backend and the built frontend; uncommon ports so a running dev setup doesn't clash */
export const BACKEND_PORT = 47100;
export const FRONTEND_PORT = 47173;
export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
