const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const IAB_CATEGORIES_PATH = '/api/domain_iab_categories';
const SAMPLE_URL = 'https://cbsnews.com';

const iabCategoriesRequest = ({
  body = {},
  authorization,
  method = 'POST',
  rawBody,
  failOnStatusCode = false,
  timeout = 120000
} = {}) =>
  cy.request({
    method,
    url: IAB_CATEGORIES_PATH,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout
  });

const collectIabEntries = (categories = []) => {
  const entries = {};

  categories.forEach((category) => {
    Object.entries(category).forEach(([key, value]) => {
      if (/^IAB/.test(key) && typeof value === 'string') {
        entries[key] = value;
      }
    });
  });

  return entries;
};

const isSuccessfulIabResponse = (body) =>
  body &&
  body.success === true &&
  body.domain &&
  Array.isArray(body.domain.categories) &&
  body.domain.categories.length > 0 &&
  Object.keys(collectIabEntries(body.domain.categories)).length > 0;

const assertIabCategoriesSuccessShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.success, `${label}: success`).to.eq(true);
  expect(body.domain, `${label}: domain`).to.be.an('object');
  expect(body.domain.categories, `${label}: domain.categories`).to.be.an('array').and.not.be.empty;
  expect(body.domain.updated_at, `${label}: domain.updated_at`).to.be.a('string').and.match(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  );

  if (body.domain.domain_url) {
    expect(body.domain.domain_url, `${label}: domain.domain_url`).to.be.a('string');
  }

  body.domain.categories.forEach((category, index) => {
    expect(category, `${label}: categories[${index}]`).to.include.keys('confidence', 'name');
    expect(category.confidence, `${label}: confidence`).to.be.a('number').and.to.be.within(0, 1);
    expect(category.name, `${label}: name`).to.be.a('string').and.not.be.empty;
  });

  const iabEntries = collectIabEntries(body.domain.categories);
  expect(iabEntries, `${label}: IAB keys in categories`).to.not.be.empty;

  Object.entries(iabEntries).forEach(([key, value]) => {
    expect(key, `${label}: IAB key format`).to.match(/^IAB/);
    expect(value, `${label}: IAB value for ${key}`).to.be.a('string').and.not.be.empty;
  });
};

const assertValidationFailure = (body, label = 'response') => {
  expect(body.success, `${label}: success`).to.eq(false);
  expect(body.message, `${label}: message`).to.exist;
};

Cypress.Commands.add('iabCategoriesRequest', iabCategoriesRequest);
Cypress.Commands.add('assertIabCategoriesSuccessShape', assertIabCategoriesSuccessShape);

Cypress.iabCategoriesApi = {
  IAB_CATEGORIES_PATH,
  SAMPLE_URL,
  collectIabEntries,
  isSuccessfulIabResponse,
  assertIabCategoriesSuccessShape,
  assertValidationFailure,
  hasMeaningfulError,
  getApiKey
};
