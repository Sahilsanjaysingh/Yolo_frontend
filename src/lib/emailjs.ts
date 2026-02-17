// Lightweight EmailJS wrapper to centralize initialization and sending.
// Uses the currently installed `emailjs-com` package (older) if available.
// This file dynamically imports the library so it doesn't bloat initial bundles.

export type TemplateParams = Record<string, any>;

let initializedUserId: string | null = null;

async function loadEmailJs(): Promise<any> {
  try {
    const mod = await import('emailjs-com');
    return (mod && (mod.default || mod));
  } catch (e) {
    // If the package isn't installed, provide a helpful error when used
    throw new Error('emailjs-com not found. Please run `npm install emailjs-com`');
  }
}

/**
 * Initialize EmailJS with your user/public key (idempotent).
 */
export async function initEmailJS(userId: string) {
  if (!userId) return;
  if (initializedUserId === userId) return;
  const emailjs = await loadEmailJs();
  if (emailjs && typeof emailjs.init === 'function') {
    emailjs.init(userId);
    initializedUserId = userId;
  }
}

/**
 * Send an email using EmailJS.
 * If userId was not previously initialized, it will be passed through as the 4th parameter
 * for compatibility with older clients.
 */
export async function sendEmail(serviceId: string, templateId: string, params: TemplateParams, userId?: string) {
  if (!serviceId || !templateId) throw new Error('Missing serviceId or templateId');
  const emailjs = await loadEmailJs();
  if (!emailjs) throw new Error('Failed to load emailjs');

  // initialize if userId provided and not yet initialized
  if (userId && initializedUserId !== userId && typeof emailjs.init === 'function') {
    emailjs.init(userId);
    initializedUserId = userId;
  }

  // send(signature) — older clients accept userId as 4th arg
  if (userId) {
    return emailjs.send(serviceId, templateId, params, userId);
  }
  return emailjs.send(serviceId, templateId, params);
}

export default {
  initEmailJS,
  sendEmail,
};
