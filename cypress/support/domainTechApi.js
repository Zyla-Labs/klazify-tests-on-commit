const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const DOMAIN_TECH_PATH = '/api/domain_tech';
const SAMPLE_URL = 'https://cbsnews.com';

const domainTechRequest = ({
  body = {},
  authorization,
  method = 'POST',
  rawBody,
  failOnStatusCode = false,
  timeout = 120000
} = {}) =>
  cy.klazifyRequest({
    method,
    url: DOMAIN_TECH_PATH,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout
  });

const isSuccessfulTechResponse = (body) =>
  body && body.success === true && body.objects?.company && Array.isArray(body.objects.company.tech);

const assertDomainTechSuccessShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.success, `${label}: success`).to.eq(true);
  expect(body.domain, `${label}: domain`).to.be.an('object');
  expect(body.objects?.company?.tech, `${label}: tech`).to.be.an('array');

  if (body.domain.domain_url) {
    expect(body.domain.domain_url, `${label}: domain_url`).to.be.a('string');
  }

  if (body.domain.updated_at) {
    expect(body.domain.updated_at, `${label}: updated_at`).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  }

  body.objects.company.tech.forEach((tech, index) => {
    expect(tech, `${label}: tech[${index}]`).to.be.a('string').and.match(/^[a-z0-9_]+$/);
  });
};

const assertValidationFailure = (body, label = 'response') => {
  expect(body.success, `${label}: success`).to.eq(false);
  expect(body.message, `${label}: message`).to.exist;
};

Cypress.Commands.add('domainTechRequest', domainTechRequest);
Cypress.Commands.add('assertDomainTechSuccessShape', assertDomainTechSuccessShape);

Cypress.domainTechApi = {
  DOMAIN_TECH_PATH,
  SAMPLE_URL,
  isSuccessfulTechResponse,
  assertDomainTechSuccessShape,
  assertValidationFailure,
  hasMeaningfulError,
  getApiKey
};
