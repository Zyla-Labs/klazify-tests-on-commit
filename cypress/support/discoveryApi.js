const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const DISCOVERY_PATH = '/api/discovery';

const RESULT_FIELDS = [
  'domain',
  'company_name',
  'company_country',
  'company_employees',
  'primary_category',
  'tech_stack',
  'global_rank',
  'monthly_visits',
  'logo_url'
];

const discoveryRequest = ({
  body = {},
  authorization,
  method = 'POST',
  rawBody,
  failOnStatusCode = false
} = {}) =>
  cy.request({
    method,
    url: DISCOVERY_PATH,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout: 60000
  });

const assertDiscoveryShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.total, `${label}: total`).to.be.a('number').and.to.be.at.least(0);
  expect(body.page, `${label}: page`).to.be.a('number').and.to.be.at.least(1);
  expect(body.total_pages, `${label}: total_pages`).to.be.a('number').and.to.be.at.least(0);
  expect(body.results, `${label}: results`).to.be.an('array');
  expect(body.results.length, `${label}: results length`).to.be.at.most(100);

  if (body.total > 0) {
    expect(body.total_pages, `${label}: total_pages when total > 0`).to.be.at.least(1);
  }

  if (body.results.length > 0) {
    const item = body.results[0];
    RESULT_FIELDS.forEach((field) => {
      expect(item, `${label}: results[0].${field}`).to.have.property(field);
    });
    expect(item.tech_stack, `${label}: tech_stack type`).to.be.an('array');
  }
};

const normalizeTech = (value) => String(value || '').toLowerCase().replace(/_/g, '');

const techMatches = (techStack, expectedTech) => {
  const needle = normalizeTech(expectedTech);
  return (techStack || []).some((tech) => normalizeTech(tech).includes(needle));
};

const isDefaultUnfilteredPayload = (body) =>
  body &&
  typeof body.total === 'number' &&
  body.total >= 500000 &&
  Array.isArray(body.results) &&
  body.results.length > 0 &&
  body.results[0].domain === 'google.com';

Cypress.Commands.add('discoveryRequest', discoveryRequest);
Cypress.Commands.add('assertDiscoveryShape', assertDiscoveryShape);

Cypress.discoveryApi = {
  DISCOVERY_PATH,
  RESULT_FIELDS,
  getApiKey,
  assertDiscoveryShape,
  hasMeaningfulError,
  isDefaultUnfilteredPayload,
  techMatches,
  normalizeTech
};
