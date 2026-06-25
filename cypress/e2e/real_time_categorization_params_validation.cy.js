describe('POST /api/real_time_categorization - casos positivos', () => {
  const { SAMPLE_URL } = Cypress.realTimeApi;

  it('responde 200 con estructura documentada para el ejemplo base', () => {
    cy.realTimeRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.status).to.eq(200);
      cy.assertRealTimeSuccessShape(response.body, 'documentacion');

      const categories = response.body.domain.categories;
      expect(categories.length).to.be.greaterThan(1);
      for (let i = 1; i < categories.length; i += 1) {
        expect(categories[i - 1].confidence, 'confidence desc').to.be.at.least(categories[i].confidence);
      }
    });
  });

  it('acepta dominio sin protocolo normalizando a https', () => {
    cy.realTimeRequest({ body: { url: 'cbsnews.com' } }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.eq(true);
      expect(response.body.domain.domain_url).to.match(/cbsnews\.com/i);
      expect(response.body.domain.categories).to.be.an('array').and.not.be.empty;
    });
  });
});

describe('POST /api/real_time_categorization - autenticacion y metodo HTTP', () => {
  const { SAMPLE_URL } = Cypress.realTimeApi;

  const assertUnauthorized = (response, label) => {
    expect(response.status, `${label}: status`).to.eq(401);
    expect(response.body.success, `${label}: success`).to.eq(false);
    expect(response.body.error, `${label}: error`).to.eq('Unauthorized');
  };

  it('rechaza solicitudes sin header Authorization', () => {
    cy.realTimeRequest({ body: { url: SAMPLE_URL }, authorization: false }).then((response) => {
      assertUnauthorized(response, 'sin header');
    });
  });

  it('rechaza token invalido', () => {
    cy.realTimeRequest({
      body: { url: SAMPLE_URL },
      authorization: 'Bearer token.invalido'
    }).then((response) => {
      assertUnauthorized(response, 'token invalido');
    });
  });

  it('rechaza Authorization sin prefijo Bearer', () => {
    cy.realTimeRequest({
      body: { url: SAMPLE_URL },
      authorization: Cypress.realTimeApi.getApiKey()
    }).then((response) => {
      assertUnauthorized(response, 'sin Bearer');
    });
  });

  it('rechaza GET con 405 Method Not Allowed', () => {
    cy.realTimeRequest({ method: 'GET', body: undefined }).then((response) => {
      expect(response.status).to.eq(405);
    });
  });
});

describe('POST /api/real_time_categorization - validacion de entrada', () => {
  const { assertValidationFailure } = Cypress.realTimeApi;

  it('rechaza url vacia con success false', () => {
    cy.realTimeRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.status).to.eq(200);
      assertValidationFailure(response.body, 'url vacia');
      expect(response.body.message.url).to.include('The url must be a valid URL.');
    });
  });

  it('detecta que errores de validacion devuelven 200 en lugar de 422', () => {
    cy.realTimeRequest({ body: { url: '' }, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(
        response.status,
        'Mejora sugerida: errores de validacion deberian devolver 422, no 200.'
      ).to.eq(200);
    });
  });
});

describe('POST /api/real_time_categorization - edge cases y mejoras de API', () => {
  const { hasMeaningfulError, isSuccessfulRealTime, SAMPLE_URL } = Cypress.realTimeApi;

  it('clasifica url invalida como /Unreachable con success true (mejora)', () => {
    cy.realTimeRequest({ body: { url: 'not-a-url' }, timeout: 60000 }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.eq(true);
      expect(response.body.domain.categories[0].name).to.eq('/Unreachable');
      expect(response.body.domain.domain_url).to.eq('https://not-a-url');

      cy.log(
        'Mejora sugerida: "not-a-url" deberia devolver 422 de validacion, no success:true con /Unreachable.'
      );
    });
  });

  it('marca dominios inalcanzables con /Unreachable y success true', () => {
    cy.realTimeRequest({
      body: { url: 'https://thisdomaindoesnotexist12345xyz.com' },
      timeout: 60000
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.domain.categories[0].name).to.eq('/Unreachable');
      expect(response.body.success).to.eq(true);

      cy.log(
        'Mejora sugerida: /Unreachable deberia responder success:false o incluir error explicito.'
      );
    });
  });

  it('detecta body sin url que devuelve mensaje de URL invalida en vez de required', () => {
    cy.realTimeRequest({ body: {}, timeout: 30000 }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(response.body.message.url).to.include('The url must be a valid URL.');

      cy.log(
        'Mejora sugerida: body vacio deberia decir "The url field is required.", no "must be a valid URL."'
      );
    });
  });

  it('detecta entradas ambiguas o ignoradas silenciosamente', () => {
    const cases = [
      {
        name: 'url numerica',
        body: { url: 12345 },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.eq(true);
          expect(response.body.domain.domain_url).to.eq('https://12345');
          expect(response.body.domain.categories[0].name).to.eq('/Unreachable');
          cy.log('Mejora sugerida: url numerica se coercea a https://12345 en lugar de rechazarse.');
        }
      },
      {
        name: 'parametro refresh documentado como innecesario',
        body: { url: SAMPLE_URL, refresh: 'true' },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(isSuccessfulRealTime(response.body)).to.eq(true);
          cy.log('Mejora sugerida: refresh se acepta aunque la docs diga que no es necesario.');
        }
      },
      {
        name: 'parametro desconocido',
        body: { url: SAMPLE_URL, foo: 'bar' },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(isSuccessfulRealTime(response.body)).to.eq(true);
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
      cy.realTimeRequest({
        body: testCase.body,
        rawBody: testCase.rawBody,
        timeout: 60000
      }).then((response) => {
        testCase.assert(response, testCase.name);
      });
    });
  });

  it('documenta campos extra en respuesta exitosa no listados en docs', () => {
    cy.realTimeRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.body).to.have.property('api_usage');
      cy.log('Mejora sugerida: documentar api_usage en la respuesta del endpoint.');
    });
  });
});
