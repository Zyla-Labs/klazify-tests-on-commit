describe('POST /api/domain_expiration - casos positivos', () => {
  const { SAMPLE_URL } = Cypress.domainExpirationApi;

  it('responde 200 con datos de registro del dominio', () => {
    cy.domainExpirationRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.status).to.eq(200);
      cy.assertDomainExpirationSuccessShape(response.body, 'documentacion');

      const reg = response.body.domain_registration_data;
      expect(new Date(reg.domain_expiration_date).getTime()).to.be.greaterThan(
        new Date(reg.domain_age_date).getTime()
      );
    });
  });

  it('acepta dominio sin protocolo', () => {
    cy.domainExpirationRequest({ body: { url: 'cbsnews.com' } }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.eq(true);
      expect(response.body.domain_registration_data.domain_expiration_date).to.match(
        Cypress.domainExpirationApi.DATE_PATTERN
      );
    });
  });

  it('acepta refresh=true cuando el plan lo permite', () => {
    cy.domainExpirationRequest({
      body: { url: SAMPLE_URL, refresh: 'true' },
      timeout: 180000
    }).then((response) => {
      if (response.body.success === false && String(response.body.message).includes('not allowed')) {
        expect(response.body.message).to.include('not allowed');
        return;
      }

      expect(response.status).to.eq(200);
      cy.assertDomainExpirationSuccessShape(response.body, 'refresh=true');
    });
  });
});

describe('POST /api/domain_expiration - autenticacion y metodo HTTP', () => {
  const { SAMPLE_URL } = Cypress.domainExpirationApi;

  const assertUnauthorized = (response, label) => {
    expect(response.status, `${label}: status`).to.eq(401);
    expect(response.body.success, `${label}: success`).to.eq(false);
    expect(response.body.error, `${label}: error`).to.eq('Unauthorized');
  };

  it('rechaza solicitudes sin header Authorization', () => {
    cy.domainExpirationRequest({ body: { url: SAMPLE_URL }, authorization: false }).then((response) => {
      assertUnauthorized(response, 'sin header');
    });
  });

  it('rechaza token invalido', () => {
    cy.domainExpirationRequest({
      body: { url: SAMPLE_URL },
      authorization: 'Bearer token.invalido'
    }).then((response) => {
      assertUnauthorized(response, 'token invalido');
    });
  });

  it('rechaza Authorization sin prefijo Bearer', () => {
    cy.domainExpirationRequest({
      body: { url: SAMPLE_URL },
      authorization: Cypress.domainExpirationApi.getApiKey()
    }).then((response) => {
      assertUnauthorized(response, 'sin Bearer');
    });
  });

  it('rechaza GET con 405 Method Not Allowed', () => {
    cy.domainExpirationRequest({ method: 'GET', body: undefined }).then((response) => {
      expect(response.status).to.eq(405);
    });
  });
});

describe('POST /api/domain_expiration - validacion de entrada', () => {
  const { assertValidationFailure } = Cypress.domainExpirationApi;

  it('rechaza url vacia con success false', () => {
    cy.domainExpirationRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.status).to.eq(200);
      assertValidationFailure(response.body, 'url vacia');
      expect(response.body.message.url).to.include('The url must be a valid URL.');
    });
  });

  it('detecta que errores de validacion devuelven 200 en lugar de 422', () => {
    cy.domainExpirationRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(response.status).to.eq(200);
    });
  });
});

describe('POST /api/domain_expiration - edge cases y mejoras de API', () => {
  const { hasMeaningfulError, isSuccessfulExpirationResponse, SAMPLE_URL } = Cypress.domainExpirationApi;

  it('devuelve success false cuando no hay datos de expiracion', () => {
    const noDataCases = [
      { name: 'url invalida', body: { url: 'not-a-url' } },
      { name: 'dominio inalcanzable', body: { url: 'https://thisdomaindoesnotexist12345xyz.com' } },
      { name: 'url numerica', body: { url: 12345 } }
    ];

    cy.wrap(noDataCases).each((testCase) => {
      cy.domainExpirationRequest({ body: testCase.body, timeout: 60000 }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        expect(response.body.success, `${testCase.name}: success`).to.eq(false);
        expect(String(response.body.message), `${testCase.name}: message`).to.include(
          "couldn't retrieve website data"
        );
      });
    });
  });

  it('detecta body sin url con mensaje de URL invalida en vez de required', () => {
    cy.domainExpirationRequest({ body: {}, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(response.body.message.url).to.include('The url must be a valid URL.');
    });
  });

  it('documenta campos documentados que no vienen en la respuesta real', () => {
    cy.domainExpirationRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      const reg = response.body.domain_registration_data;

      expect(reg).to.have.property('domain_age_date');
      expect(reg).to.have.property('domain_expiration_date');
      expect(reg).to.not.have.property('domain_age_days_ago');
      expect(reg).to.not.have.property('domain_expiration_days_left');
      expect(response.body).to.have.property('api_usage');
      expect(response.body.domain).to.have.property('updated_at');

      cy.log(
        'Mejora sugerida: docs listan domain_age_days_ago y domain_expiration_days_left pero no se devuelven.'
      );
      cy.log('Mejora sugerida: docs mencionan registrar info pero no hay campo de registrar en la respuesta.');
    });
  });

  it('detecta entradas ambiguas o ignoradas silenciosamente', () => {
    const cases = [
      {
        name: 'parametro desconocido',
        body: { url: SAMPLE_URL, foo: 'bar' },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(isSuccessfulExpirationResponse(response.body)).to.eq(true);
        }
      },
      {
        name: 'JSON malformado',
        rawBody: '{bad json}',
        assert: (response) => {
          expect(response.body.success).to.eq(false);
          expect(hasMeaningfulError(response)).to.eq(true);
        }
      }
    ];

    cy.wrap(cases).each((testCase) => {
      cy.domainExpirationRequest({
        body: testCase.body,
        rawBody: testCase.rawBody,
        timeout: 30000
      }).then((response) => {
        testCase.assert(response, testCase.name);
      });
    });
  });
});
