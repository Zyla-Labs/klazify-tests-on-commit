const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const DOMAIN_LOGO_PATH = '/api/domain_logo';
const SAMPLE_URL = 'https://cbsnews.com';

const domainLogoRequest = ({
  body = {},
  authorization,
  method = 'POST',
  rawBody,
  failOnStatusCode = false,
  timeout = 120000
} = {}) =>
  cy.klazifyRequest({
    method,
    url: DOMAIN_LOGO_PATH,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout
  });

const isSuccessfulLogoResponse = (body) =>
  body && body.success === true && body.domain && Object.prototype.hasOwnProperty.call(body.domain, 'logo_url');

const assertDomainLogoSuccessShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.success, `${label}: success`).to.eq(true);
  expect(body.domain, `${label}: domain`).to.be.an('object');
  expect(body.domain, `${label}: domain`).to.include.keys('domain_url', 'logo_url', 'updated_at');

  if (body.domain.domain_url) {
    expect(body.domain.domain_url, `${label}: domain_url`).to.be.a('string');
  }

  if (body.domain.updated_at) {
    expect(body.domain.updated_at, `${label}: updated_at`).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  }

  if (body.domain.logo_url) {
    expect(body.domain.logo_url, `${label}: logo_url`).to.match(/^https?:\/\//);
  }
};

const assertValidationFailure = (body, label = 'response') => {
  expect(body.success, `${label}: success`).to.eq(false);
  expect(body.message, `${label}: message`).to.exist;
};

Cypress.Commands.add('domainLogoRequest', domainLogoRequest);
Cypress.Commands.add('assertDomainLogoSuccessShape', assertDomainLogoSuccessShape);

Cypress.domainLogoApi = {
  DOMAIN_LOGO_PATH,
  SAMPLE_URL,
  isSuccessfulLogoResponse,
  assertDomainLogoSuccessShape,
  assertValidationFailure,
  hasMeaningfulError,
  getApiKey
};
