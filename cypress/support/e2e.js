import './klazifyApi';
import './discoveryApi';
import './categorizeApi';
import './realTimeApi';
import './iabCategoriesApi';
import './domainCompanyApi';
import './domainTechApi';
import './domainLogoApi';
import './domainExpirationApi';

beforeEach(() => {
  Cypress.klazifyApi.clearRequestLog();
});

Cypress.on('fail', (error) => {
  Cypress.klazifyApi.logFailedRequests();
  throw Cypress.klazifyApi.appendFailedRequestDetails(error);
});
