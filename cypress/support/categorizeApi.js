const { getApiKey, buildHeaders, hasMeaningfulError } = Cypress.klazifyApi;

const CATEGORIZE_PATH = '/api/categorize';

const SOCIAL_MEDIA_KEYS = [
  'facebook_url',
  'twitter_url',
  'instagram_url',
  'youtube_url',
  'linkedin_url',
  'github_url',
  'pinterest_url',
  'medium_url'
];

const SAMPLE_URL = 'https://cbsnews.com';

const categorizeRequest = ({
  body = {},
  authorization,
  method = 'POST',
  query,
  rawBody,
  failOnStatusCode = false,
  timeout = 120000
} = {}) => {
  const url = query ? `${CATEGORIZE_PATH}?${query}` : CATEGORIZE_PATH;

  return cy.klazifyRequest({
    method,
    url,
    headers: buildHeaders(authorization),
    body: rawBody !== undefined ? rawBody : body,
    failOnStatusCode,
    timeout
  });
};

const isSuccessfulCategorize = (body) =>
  body &&
  body.domain &&
  Array.isArray(body.domain.categories) &&
  body.domain.categories.length > 0 &&
  body.success !== false;

const assertCategorizeSuccessShape = (body, label = 'response') => {
  expect(body, `${label}: body`).to.be.an('object');
  expect(body.domain, `${label}: domain`).to.be.an('object');
  expect(body.domain.categories, `${label}: domain.categories`).to.be.an('array').and.not.be.empty;

  body.domain.categories.forEach((category, index) => {
    expect(category, `${label}: categories[${index}]`).to.include.keys('confidence', 'name');
    expect(category.confidence, `${label}: confidence`).to.be.a('number').and.to.be.within(0, 1);
    expect(category.name, `${label}: name`).to.be.a('string').and.not.be.empty;
  });

  if (Object.prototype.hasOwnProperty.call(body, 'success')) {
    expect(body.success, `${label}: success`).to.eq(true);
  }

  if (body.domain.social_media) {
    expect(body.domain.social_media, `${label}: social_media`).to.be.an('object');
    SOCIAL_MEDIA_KEYS.forEach((key) => {
      expect(body.domain.social_media, `${label}: social_media.${key}`).to.have.property(key);
    });
  }

  if (body.objects?.company) {
    const company = body.objects.company;
    expect(company, `${label}: objects.company`).to.be.an('object');
    if (company.tech) {
      expect(company.tech, `${label}: company.tech`).to.be.an('array');
    }
  }
};

const assertValidationFailure = (body, label = 'response') => {
  expect(body.success, `${label}: success`).to.eq(false);
  expect(body.message, `${label}: message`).to.exist;
};

Cypress.Commands.add('categorizeRequest', categorizeRequest);
Cypress.Commands.add('assertCategorizeSuccessShape', assertCategorizeSuccessShape);

Cypress.categorizeApi = {
  CATEGORIZE_PATH,
  SAMPLE_URL,
  SOCIAL_MEDIA_KEYS,
  isSuccessfulCategorize,
  assertCategorizeSuccessShape,
  assertValidationFailure,
  hasMeaningfulError,
  getApiKey
};
