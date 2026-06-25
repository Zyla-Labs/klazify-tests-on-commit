const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const DOMAIN_COMPANY_PATH = '/api/domain_company';
const SAMPLE_URL = 'https://cbsnews.com';

const COMPANY_FIELDS = [
  'name',
  'city',
  'stateCode',
  'countryCode',
  'employeesRange',
  'revenue',
  'raised',
  'tags'
];

const domainCompanyRequest = ({
  body = {},
  authorization,
  method = 'POST',
  rawBody,
  failOnStatusCode = false,
  timeout = 120000
} = {}) =>
  cy.request({
    method,
    url: DOMAIN_COMPANY_PATH,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout
  });

const isSuccessfulCompanyResponse = (body) =>
  body &&
  body.success === true &&
  body.objects?.company &&
  typeof body.objects.company.name === 'string' &&
  body.objects.company.name.length > 0;

const assertDomainCompanySuccessShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.success, `${label}: success`).to.eq(true);
  expect(body.domain, `${label}: domain`).to.be.an('object');
  expect(body.objects, `${label}: objects`).to.be.an('object');
  expect(body.objects.company, `${label}: objects.company`).to.be.an('object');

  COMPANY_FIELDS.forEach((field) => {
    expect(body.objects.company, `${label}: company.${field}`).to.have.property(field);
  });

  expect(body.objects.company.name, `${label}: company.name`).to.be.a('string').and.not.be.empty;
  expect(body.objects.company.countryCode, `${label}: countryCode`).to.match(/^[A-Z]{2}$/);
  expect(body.objects.company.tags, `${label}: tags`).to.be.an('array');

  if (body.domain.domain_url) {
    expect(body.domain.domain_url, `${label}: domain_url`).to.be.a('string');
  }

  if (body.domain.updated_at) {
    expect(body.domain.updated_at, `${label}: updated_at`).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  }
};

const assertValidationFailure = (body, label = 'response') => {
  expect(body.success, `${label}: success`).to.eq(false);
  expect(body.message, `${label}: message`).to.exist;
};

Cypress.Commands.add('domainCompanyRequest', domainCompanyRequest);
Cypress.Commands.add('assertDomainCompanySuccessShape', assertDomainCompanySuccessShape);

Cypress.domainCompanyApi = {
  DOMAIN_COMPANY_PATH,
  SAMPLE_URL,
  COMPANY_FIELDS,
  isSuccessfulCompanyResponse,
  assertDomainCompanySuccessShape,
  assertValidationFailure,
  hasMeaningfulError,
  getApiKey
};
