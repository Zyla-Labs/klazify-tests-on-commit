describe('POST /api/domain_iab_categories - casos positivos', () => {
  const { SAMPLE_URL, collectIabEntries } = Cypress.iabCategoriesApi;

  it('responde 200 con categorias IAB embebidas en domain.categories', () => {
    cy.iabCategoriesRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.status).to.eq(200);
      cy.assertIabCategoriesSuccessShape(response.body, 'documentacion');

      const iabEntries = collectIabEntries(response.body.domain.categories);
      const hasV1 = Object.keys(iabEntries).some((key) => /^IAB\d+$/.test(key));
      const hasV3 = Object.keys(iabEntries).some((key) => key.startsWith('IAB-'));

      expect(hasV1 || hasV3, 'al menos un mapeo IAB V1 o V3').to.eq(true);
    });
  });

  it('acepta dominio sin protocolo', () => {
    cy.iabCategoriesRequest({ body: { url: 'cbsnews.com' } }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.eq(true);
      expect(collectIabEntries(response.body.domain.categories)).to.not.be.empty;
    });
  });

  it('acepta refresh=true cuando el plan lo permite', () => {
    cy.iabCategoriesRequest({
      body: { url: SAMPLE_URL, refresh: 'true' },
      timeout: 180000
    }).then((response) => {
      if (response.body.success === false && String(response.body.message).includes('not allowed')) {
        cy.log('Plan actual no permite refresh=true — comportamiento esperado para planes inferiores a Advanced.');
        expect(response.body.message).to.include('not allowed');
        return;
      }

      expect(response.status).to.eq(200);
      cy.assertIabCategoriesSuccessShape(response.body, 'refresh=true');
    });
  });
});

describe('POST /api/domain_iab_categories - autenticacion y metodo HTTP', () => {
  const { SAMPLE_URL } = Cypress.iabCategoriesApi;

  const assertUnauthorized = (response, label) => {
    expect(response.status, `${label}: status`).to.eq(401);
    expect(response.body.success, `${label}: success`).to.eq(false);
    expect(response.body.error, `${label}: error`).to.eq('Unauthorized');
  };

  it('rechaza solicitudes sin header Authorization', () => {
    cy.iabCategoriesRequest({ body: { url: SAMPLE_URL }, authorization: false }).then((response) => {
      assertUnauthorized(response, 'sin header');
    });
  });

  it('rechaza token invalido', () => {
    cy.iabCategoriesRequest({
      body: { url: SAMPLE_URL },
      authorization: 'Bearer token.invalido'
    }).then((response) => {
      assertUnauthorized(response, 'token invalido');
    });
  });

  it('rechaza Authorization sin prefijo Bearer', () => {
    cy.iabCategoriesRequest({
      body: { url: SAMPLE_URL },
      authorization: Cypress.iabCategoriesApi.getApiKey()
    }).then((response) => {
      assertUnauthorized(response, 'sin Bearer');
    });
  });

  it('rechaza GET con 405 Method Not Allowed', () => {
    cy.iabCategoriesRequest({ method: 'GET', body: undefined }).then((response) => {
      expect(response.status).to.eq(405);
    });
  });
});

describe('POST /api/domain_iab_categories - validacion de entrada', () => {
  const { assertValidationFailure } = Cypress.iabCategoriesApi;

  it('rechaza url vacia con success false', () => {
    cy.iabCategoriesRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.status).to.eq(200);
      assertValidationFailure(response.body, 'url vacia');
      expect(response.body.message.url).to.include('The url must be a valid URL.');
    });
  });

  it('detecta que errores de validacion devuelven 200 en lugar de 422', () => {
    cy.iabCategoriesRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(
        response.status,
        'Mejora sugerida: errores de validacion deberian devolver 422, no 200.'
      ).to.eq(200);
    });
  });
});

describe('POST /api/domain_iab_categories - edge cases y mejoras de API', () => {
  const { hasMeaningfulError, isSuccessfulIabResponse, SAMPLE_URL } = Cypress.iabCategoriesApi;

  it('devuelve success false cuando no hay mapeo IAB para la URL', () => {
    const noIabCases = [
      { name: 'url invalida', body: { url: 'not-a-url' } },
      { name: 'dominio inalcanzable', body: { url: 'https://thisdomaindoesnotexist12345xyz.com' } },
      { name: 'url numerica', body: { url: 12345 } }
    ];

    cy.wrap(noIabCases).each((testCase) => {
      cy.iabCategoriesRequest({ body: testCase.body, timeout: 60000 }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        expect(response.body.success, `${testCase.name}: success`).to.eq(false);
        expect(String(response.body.message), `${testCase.name}: message`).to.include(
          'unable to classify'
        );
      });
    });
  });

  it('detecta body sin url con mensaje de URL invalida en vez de required', () => {
    cy.iabCategoriesRequest({ body: {}, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(response.body.message.url).to.include('The url must be a valid URL.');

      cy.log(
        'Mejora sugerida: body vacio deberia decir "The url field is required.", no "must be a valid URL."'
      );
    });
  });

  it('documenta discrepancia entre docs (IAB_categories) y respuesta real (categories[])', () => {
    cy.iabCategoriesRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.body.domain).to.have.property('categories');
      expect(response.body.domain.categories).to.be.an('array');
      expect(isSuccessfulIabResponse(response.body)).to.eq(true);

      cy.log(
        'Mejora sugerida: la documentacion describe domain.IAB_categories (objeto plano), pero la API devuelve domain.categories[] con claves IAB embebidas por categoria.'
      );
    });
  });

  it('detecta entradas ambiguas o ignoradas silenciosamente', () => {
    const cases = [
      {
        name: 'parametro desconocido',
        body: { url: SAMPLE_URL, foo: 'bar' },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(isSuccessfulIabResponse(response.body)).to.eq(true);
          cy.log('Mejora sugerida: parametro desconocido "foo" se ignora sin aviso.');
        }
      },
      {
        name: 'JSON malformado',
        rawBody: '{bad json}',
        assert: (response) => {
          expect(response.body.success).to.eq(false);
          expect(hasMeaningfulError(response)).to.eq(true);
          cy.log('Mejora sugerida: JSON malformado devuelve 200 con error de url en lugar de 400.');
        }
      }
    ];

    cy.wrap(cases).each((testCase) => {
      cy.iabCategoriesRequest({
        body: testCase.body,
        rawBody: testCase.rawBody,
        timeout: 30000
      }).then((response) => {
        testCase.assert(response, testCase.name);
      });
    });
  });

  it('documenta campo api_usage no listado en docs', () => {
    cy.iabCategoriesRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.body).to.have.property('api_usage');
      cy.log('Mejora sugerida: documentar api_usage en la respuesta del endpoint.');
    });
  });
});
