const MAX_429_RETRIES = 3;
const REQUEST_LOG_BODY_MAX_LENGTH = 4000;

const rateLimitState = {
  timestamps: []
};

const requestLogState = {
  entries: []
};

const stringifyForLog = (value, maxLength = REQUEST_LOG_BODY_MAX_LENGTH) => {
  if (value === undefined) {
    return '(none)';
  }

  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return text.length > maxLength ? `${text.slice(0, maxLength)}... [truncated]` : text;
  } catch {
    return String(value);
  }
};

const clearRequestLog = () => {
  requestLogState.entries = [];
};

const recordRequest = (entry) => {
  requestLogState.entries.push(entry);
};

const formatRequestLogEntry = (entry, index) => {
  const params =
    entry.body !== undefined
      ? entry.body
      : entry.qs !== undefined
        ? entry.qs
        : entry.query !== undefined
          ? entry.query
          : null;

  return [
    `--- Request ${index + 1} ---`,
    `${entry.method} ${entry.fullUrl}`,
    `Params: ${stringifyForLog(params)}`,
    `Status: ${entry.status}`,
    `Response: ${stringifyForLog(entry.responseBody)}`
  ].join('\n');
};

const formatFailedRequestDetails = () => {
  if (requestLogState.entries.length === 0) {
    return '';
  }

  return `\n\nRequest details:\n${requestLogState.entries.map(formatRequestLogEntry).join('\n\n')}`;
};

const logFailedRequests = () => {
  const message = formatFailedRequestDetails();

  if (!message) {
    return;
  }

  Cypress.log({
    name: 'failed-test-requests',
    displayName: 'FAILED REQUEST',
    message: message.trim(),
    consoleProps: () => ({ requests: requestLogState.entries })
  });

  // Visible en terminal / CI ademas del runner de Cypress.
  console.error(`[Cypress] Failed test request details:${message}`);
};

const appendFailedRequestDetails = (error) => {
  const details = formatFailedRequestDetails();

  if (!details || !error) {
    return error;
  }

  if (!error.message.includes('Request details:')) {
    error.message = `${error.message}${details}`;
  }

  return error;
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

      const baseUrl = (Cypress.config('baseUrl') || '').replace(/\/$/, '');
      const requestPath = requestOptions.url || '';
      const [pathOnly, queryFromUrl] = requestPath.split('?');

      recordRequest({
        method: (requestOptions.method || 'GET').toUpperCase(),
        path: pathOnly,
        fullUrl: `${baseUrl}${requestPath.startsWith('/') ? '' : '/'}${requestPath}`,
        body: requestOptions.body,
        qs: requestOptions.qs,
        query: queryFromUrl,
        status: response.status,
        responseBody: response.body
      });

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
  klazifyRequest,
  clearRequestLog,
  logFailedRequests,
  appendFailedRequestDetails
};
