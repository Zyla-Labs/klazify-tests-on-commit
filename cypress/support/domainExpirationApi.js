const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const DOMAIN_EXPIRATION_PATH = '/api/domain_expiration';
const SAMPLE_URL = 'https://cbsnews.com';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const domainExpirationRequest = ({
  body = {},
  authorization,
  method = 'POST',
  rawBody,
  failOnStatusCode = false,
  timeout = 120000
} = {}) =>
  cy.klazifyRequest({
    method,
    url: DOMAIN_EXPIRATION_PATH,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout
  });

const isSuccessfulExpirationResponse = (body) =>
  body &&
  body.success === true &&
  body.domain_registration_data &&
  typeof body.domain_registration_data.domain_age_date === 'string' &&
  typeof body.domain_registration_data.domain_expiration_date === 'string';

const assertDomainExpirationSuccessShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.success, `${label}: success`).to.eq(true);
  expect(body.domain, `${label}: domain`).to.be.an('object');
  expect(body.domain_registration_data, `${label}: domain_registration_data`).to.be.an('object');

  const reg = body.domain_registration_data;
  expect(reg.domain_age_date, `${label}: domain_age_date`).to.match(DATE_PATTERN);
  expect(reg.domain_expiration_date, `${label}: domain_expiration_date`).to.match(DATE_PATTERN);

  if (body.domain.domain_url) {
    expect(body.domain.domain_url, `${label}: domain_url`).to.be.a('string');
  }

  if (Object.prototype.hasOwnProperty.call(reg, 'domain_age_days_ago')) {
    expect(reg.domain_age_days_ago, `${label}: domain_age_days_ago`).to.be.a('number');
  }

  if (Object.prototype.hasOwnProperty.call(reg, 'domain_expiration_days_left')) {
    expect(reg.domain_expiration_days_left, `${label}: domain_expiration_days_left`).to.be.a('number');
  }
};

const assertValidationFailure = (body, label = 'response') => {
  expect(body.success, `${label}: success`).to.eq(false);
  expect(body.message, `${label}: message`).to.exist;
};

Cypress.Commands.add('domainExpirationRequest', domainExpirationRequest);
Cypress.Commands.add('assertDomainExpirationSuccessShape', assertDomainExpirationSuccessShape);

Cypress.domainExpirationApi = {
  DOMAIN_EXPIRATION_PATH,
  SAMPLE_URL,
  DATE_PATTERN,
  isSuccessfulExpirationResponse,
  assertDomainExpirationSuccessShape,
  assertValidationFailure,
  hasMeaningfulError,
  getApiKey
};
