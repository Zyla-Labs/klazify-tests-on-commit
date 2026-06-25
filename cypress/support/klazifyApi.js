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

Cypress.klazifyApi = {
  getApiKey,
  buildHeaders,
  hasMeaningfulError
};
