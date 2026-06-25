describe('POST /api/domain_tech - casos positivos', () => {
  const { SAMPLE_URL } = Cypress.domainTechApi;

  it('responde 200 con tech stack en objects.company.tech', () => {
    cy.domainTechRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.status).to.eq(200);
      cy.assertDomainTechSuccessShape(response.body, 'documentacion');
      expect(response.body.objects.company.tech.length).to.be.greaterThan(0);
    });
  });

  it('acepta dominio sin protocolo', () => {
    cy.domainTechRequest({ body: { url: 'cbsnews.com' } }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.eq(true);
      expect(response.body.objects.company.tech).to.be.an('array').and.not.be.empty;
    });
  });

  it('acepta refresh=true cuando el plan lo permite', () => {
    cy.domainTechRequest({
      body: { url: SAMPLE_URL, refresh: 'true' },
      timeout: 180000
    }).then((response) => {
      if (response.body.success === false && String(response.body.message).includes('not allowed')) {
        expect(response.body.message).to.include('not allowed');
        return;
      }

      expect(response.status).to.eq(200);
      cy.assertDomainTechSuccessShape(response.body, 'refresh=true');
    });
  });
});

describe('POST /api/domain_tech - autenticacion y metodo HTTP', () => {
  const { SAMPLE_URL } = Cypress.domainTechApi;

  const assertUnauthorized = (response, label) => {
    expect(response.status, `${label}: status`).to.eq(401);
    expect(response.body.success, `${label}: success`).to.eq(false);
    expect(response.body.error, `${label}: error`).to.eq('Unauthorized');
  };

  it('rechaza solicitudes sin header Authorization', () => {
    cy.domainTechRequest({ body: { url: SAMPLE_URL }, authorization: false }).then((response) => {
      assertUnauthorized(response, 'sin header');
    });
  });

  it('rechaza token invalido', () => {
    cy.domainTechRequest({
      body: { url: SAMPLE_URL },
      authorization: 'Bearer token.invalido'
    }).then((response) => {
      assertUnauthorized(response, 'token invalido');
    });
  });

  it('rechaza Authorization sin prefijo Bearer', () => {
    cy.domainTechRequest({
      body: { url: SAMPLE_URL },
      authorization: Cypress.domainTechApi.getApiKey()
    }).then((response) => {
      assertUnauthorized(response, 'sin Bearer');
    });
  });

  it('rechaza GET con 405 Method Not Allowed', () => {
    cy.domainTechRequest({ method: 'GET', body: undefined }).then((response) => {
      expect(response.status).to.eq(405);
    });
  });
});

describe('POST /api/domain_tech - validacion de entrada', () => {
  const { assertValidationFailure } = Cypress.domainTechApi;

  it('rechaza url vacia con success false', () => {
    cy.domainTechRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.status).to.eq(200);
      assertValidationFailure(response.body, 'url vacia');
      expect(response.body.message.url).to.include('The url must be a valid URL.');
    });
  });

  it('detecta que errores de validacion devuelven 200 en lugar de 422', () => {
    cy.domainTechRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(response.status).to.eq(200);
    });
  });
});

describe('POST /api/domain_tech - edge cases y mejoras de API', () => {
  const { hasMeaningfulError, isSuccessfulTechResponse, SAMPLE_URL } = Cypress.domainTechApi;

  it('devuelve success false cuando no hay tech stack disponible', () => {
    const noDataCases = [
      { name: 'url invalida', body: { url: 'not-a-url' } },
      { name: 'dominio inalcanzable', body: { url: 'https://thisdomaindoesnotexist12345xyz.com' } },
      { name: 'url numerica', body: { url: 12345 } }
    ];

    cy.wrap(noDataCases).each((testCase) => {
      cy.domainTechRequest({ body: testCase.body, timeout: 60000 }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        expect(response.body.success, `${testCase.name}: success`).to.eq(false);
        expect(String(response.body.message), `${testCase.name}: message`).to.include(
          "couldn't retrieve website data"
        );
      });
    });
  });

  it('detecta body sin url con mensaje de URL invalida en vez de required', () => {
    cy.domainTechRequest({ body: {}, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(response.body.message.url).to.include('The url must be a valid URL.');
    });
  });

  it('documenta campos extra no listados en docs', () => {
    cy.domainTechRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.body).to.have.property('api_usage');
      expect(Object.keys(response.body.objects.company)).to.deep.eq(['tech']);
    });
  });

  it('detecta entradas ambiguas o ignoradas silenciosamente', () => {
    const cases = [
      {
        name: 'parametro desconocido',
        body: { url: SAMPLE_URL, foo: 'bar' },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(isSuccessfulTechResponse(response.body)).to.eq(true);
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
      cy.domainTechRequest({
        body: testCase.body,
        rawBody: testCase.rawBody,
        timeout: 30000
      }).then((response) => {
        testCase.assert(response, testCase.name);
      });
    });
  });
});
