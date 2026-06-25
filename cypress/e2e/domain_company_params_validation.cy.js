describe('POST /api/domain_company - casos positivos', () => {
  const { SAMPLE_URL } = Cypress.domainCompanyApi;

  it('responde 200 con estructura de company documentada', () => {
    cy.domainCompanyRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.status).to.eq(200);
      cy.assertDomainCompanySuccessShape(response.body, 'documentacion');
    });
  });

  it('acepta dominio sin protocolo', () => {
    cy.domainCompanyRequest({ body: { url: 'cbsnews.com' } }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.eq(true);
      expect(response.body.objects.company.name).to.be.a('string').and.not.be.empty;
    });
  });

  it('acepta refresh=true cuando el plan lo permite', () => {
    cy.domainCompanyRequest({
      body: { url: SAMPLE_URL, refresh: 'true' },
      timeout: 180000
    }).then((response) => {
      if (response.body.success === false && String(response.body.message).includes('not allowed')) {
        cy.log('Plan actual no permite refresh=true — comportamiento esperado para planes inferiores a Advanced.');
        expect(response.body.message).to.include('not allowed');
        return;
      }

      expect(response.status).to.eq(200);
      cy.assertDomainCompanySuccessShape(response.body, 'refresh=true');
    });
  });
});

describe('POST /api/domain_company - autenticacion y metodo HTTP', () => {
  const { SAMPLE_URL } = Cypress.domainCompanyApi;

  const assertUnauthorized = (response, label) => {
    expect(response.status, `${label}: status`).to.eq(401);
    expect(response.body.success, `${label}: success`).to.eq(false);
    expect(response.body.error, `${label}: error`).to.eq('Unauthorized');
  };

  it('rechaza solicitudes sin header Authorization', () => {
    cy.domainCompanyRequest({ body: { url: SAMPLE_URL }, authorization: false }).then((response) => {
      assertUnauthorized(response, 'sin header');
    });
  });

  it('rechaza token invalido', () => {
    cy.domainCompanyRequest({
      body: { url: SAMPLE_URL },
      authorization: 'Bearer token.invalido'
    }).then((response) => {
      assertUnauthorized(response, 'token invalido');
    });
  });

  it('rechaza Authorization sin prefijo Bearer', () => {
    cy.domainCompanyRequest({
      body: { url: SAMPLE_URL },
      authorization: Cypress.domainCompanyApi.getApiKey()
    }).then((response) => {
      assertUnauthorized(response, 'sin Bearer');
    });
  });

  it('rechaza GET con 405 Method Not Allowed', () => {
    cy.domainCompanyRequest({ method: 'GET', body: undefined }).then((response) => {
      expect(response.status).to.eq(405);
    });
  });
});

describe('POST /api/domain_company - validacion de entrada', () => {
  const { assertValidationFailure } = Cypress.domainCompanyApi;

  it('rechaza url vacia con success false', () => {
    cy.domainCompanyRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.status).to.eq(200);
      assertValidationFailure(response.body, 'url vacia');
      expect(response.body.message.url).to.include('The url must be a valid URL.');
    });
  });

  it('detecta que errores de validacion devuelven 200 en lugar de 422', () => {
    cy.domainCompanyRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(
        response.status,
        'Mejora sugerida: errores de validacion deberian devolver 422, no 200.'
      ).to.eq(200);
    });
  });
});

describe('POST /api/domain_company - edge cases y mejoras de API', () => {
  const { hasMeaningfulError, isSuccessfulCompanyResponse, SAMPLE_URL } = Cypress.domainCompanyApi;

  it('devuelve success false cuando no hay datos de company', () => {
    const noDataCases = [
      { name: 'url invalida', body: { url: 'not-a-url' } },
      { name: 'dominio inalcanzable', body: { url: 'https://thisdomaindoesnotexist12345xyz.com' } },
      { name: 'url numerica', body: { url: 12345 } }
    ];

    cy.wrap(noDataCases).each((testCase) => {
      cy.domainCompanyRequest({ body: testCase.body, timeout: 60000 }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        expect(response.body.success, `${testCase.name}: success`).to.eq(false);
        expect(String(response.body.message), `${testCase.name}: message`).to.include(
          "couldn't retrieve website data"
        );
      });
    });
  });

  it('detecta body sin url con mensaje de URL invalida en vez de required', () => {
    cy.domainCompanyRequest({ body: {}, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(response.body.message.url).to.include('The url must be a valid URL.');

      cy.log(
        'Mejora sugerida: body vacio deberia decir "The url field is required.", no "must be a valid URL."'
      );
    });
  });

  it('documenta campos extra o ausentes respecto a la documentacion', () => {
    cy.domainCompanyRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.body).to.have.property('api_usage');
      expect(response.body.domain).to.have.property('updated_at');
      expect(response.body.objects.company).to.not.have.property('tech');

      cy.log('Mejora sugerida: documentar api_usage y domain.updated_at en la respuesta.');
      cy.log('Nota: tech no se incluye en domain_company (solo en domain_tech / categorize).');
    });
  });

  it('detecta entradas ambiguas o ignoradas silenciosamente', () => {
    const cases = [
      {
        name: 'parametro desconocido',
        body: { url: SAMPLE_URL, foo: 'bar' },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(isSuccessfulCompanyResponse(response.body)).to.eq(true);
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
      cy.domainCompanyRequest({
        body: testCase.body,
        rawBody: testCase.rawBody,
        timeout: 30000
      }).then((response) => {
        testCase.assert(response, testCase.name);
      });
    });
  });
});
