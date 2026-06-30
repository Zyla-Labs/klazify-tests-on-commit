const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const REAL_TIME_PATH = '/api/real_time_categorization';
const SAMPLE_URL = 'https://cbsnews.com';

const realTimeRequest = ({
  body = {},
  authorization,
  method = 'POST',
  rawBody,
  failOnStatusCode = false,
  timeout = 120000
} = {}) =>
  cy.klazifyRequest({
    method,
    url: REAL_TIME_PATH,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout
  });

const isSuccessfulRealTime = (body) =>
  body &&
  body.domain &&
  Array.isArray(body.domain.categories) &&
  body.domain.categories.length > 0 &&
  body.success === true;

const assertRealTimeSuccessShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.success, `${label}: success`).to.eq(true);
  expect(body.domain, `${label}: domain`).to.be.an('object');
  expect(body.domain.categories, `${label}: domain.categories`).to.be.an('array').and.not.be.empty;
  expect(body.domain.domain_url, `${label}: domain.domain_url`).to.be.a('string').and.not.be.empty;
  expect(body.domain.updated_at, `${label}: domain.updated_at`).to.be.a('string').and.match(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  );

  body.domain.categories.forEach((category, index) => {
    expect(category, `${label}: categories[${index}]`).to.include.keys('confidence', 'name');
    expect(category.confidence, `${label}: confidence`).to.be.a('number').and.to.be.within(0, 1);
    expect(category.name, `${label}: name`).to.be.a('string').and.not.be.empty;
  });
};

const assertValidationFailure = (body, label = 'response') => {
  expect(body.success, `${label}: success`).to.eq(false);
  expect(body.message, `${label}: message`).to.exist;
};

Cypress.Commands.add('realTimeRequest', realTimeRequest);
Cypress.Commands.add('assertRealTimeSuccessShape', assertRealTimeSuccessShape);

Cypress.realTimeApi = {
  REAL_TIME_PATH,
  SAMPLE_URL,
  isSuccessfulRealTime,
  assertRealTimeSuccessShape,
  assertValidationFailure,
  hasMeaningfulError,
  getApiKey
};
