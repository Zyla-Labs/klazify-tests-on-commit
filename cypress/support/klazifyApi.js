const MAX_429_RETRIES = 3;

const rateLimitState = {
  timestamps: []
};

const getRateLimitConfig = () => {
  const perMinute = Number(Cypress.env('KLAZIFY_RATE_LIMIT_PER_MINUTE')) || 240;
  const windowMs = Number(Cypress.env('KLAZIFY_RATE_LIMIT_WINDOW_MS')) || 10000;
  const windowsPerMinute = 60000 / windowMs;
  const perWindow = Math.floor(perMinute / windowsPerMinute);

  return { perMinute, windowMs, perWindow };
};

const getApiKey = () => {
  const key = Cypress.env('KLAZIFY_API_KEY');

  if (!key) {
    throw new Error(
      'KLAZIFY_API_KEY no está definida. ' +
        'Crea un archivo .env en la raíz del proyecto o configura la variable de entorno KLAZIFY_API_KEY.'
    );
  }

  return key;
};

const buildHeaders = (authorization) => {
  const headers = { 'Content-Type': 'application/json' };

  if (authorization !== false) {
    headers.Authorization = authorization || `Bearer ${getApiKey()}`;
  }

  return headers;
};

const hasMeaningfulError = (response) => {
  const body = response.body || {};
  const hasBodyError =
    typeof body.error === 'string' ||
    (body.error && typeof body.error === 'object') ||
    (typeof body.message === 'string' && body.message.trim() !== '') ||
    (body.message && typeof body.message === 'object') ||
    body.success === false;

  return response.status >= 400 || hasBodyError;
};

const computeRateLimitWaitMs = (now = Date.now()) => {
  const { perMinute, windowMs, perWindow } = getRateLimitConfig();

  rateLimitState.timestamps = rateLimitState.timestamps.filter((timestamp) => timestamp > now - 60000);

  const inWindow = rateLimitState.timestamps.filter((timestamp) => timestamp > now - windowMs);

  let waitMs = 0;

  if (inWindow.length >= perWindow) {
    waitMs = Math.max(waitMs, inWindow[0] - (now - windowMs) + 25);
  }

  if (rateLimitState.timestamps.length >= perMinute) {
    waitMs = Math.max(waitMs, rateLimitState.timestamps[0] - (now - 60000) + 25);
  }

  return waitMs;
};

const waitForKlazifyRateLimit = () =>
  cy.wrap(null, { log: false }).then({ timeout: 120000 }, () => {
    return new Cypress.Promise((resolve) => {
      const schedule = () => {
        const waitMs = computeRateLimitWaitMs();

        if (waitMs > 0) {
          setTimeout(schedule, Math.ceil(waitMs));
          return;
        }

        rateLimitState.timestamps.push(Date.now());
        resolve();
      };

      schedule();
    });
  });

const klazifyRequest = (options = {}, attempt = 0) => {
  const requestOptions = { failOnStatusCode: false, ...options };

  return waitForKlazifyRateLimit().then(() =>
    cy.request(requestOptions).then((response) => {
      if (response.status === 429 && attempt < MAX_429_RETRIES) {
        const { windowMs } = getRateLimitConfig();
        const retryAfterHeader = Number(response.headers?.['retry-after']);
        const waitMs =
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader * 1000
            : windowMs + 100;

        Cypress.log({
          name: 'rate-limit',
          message: `429 recibido, reintento ${attempt + 1}/${MAX_429_RETRIES} en ${waitMs}ms`
        });

        return cy.wait(waitMs, { log: false }).then(() => klazifyRequest(options, attempt + 1));
      }

      return response;
    })
  );
};

Cypress.Commands.add('klazifyRequest', klazifyRequest);

Cypress.klazifyApi = {
  getRateLimitConfig,
  getApiKey,
  buildHeaders,
  hasMeaningfulError,
  waitForKlazifyRateLimit,
  klazifyRequest
};
