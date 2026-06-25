describe('POST /api/categorize - casos positivos', () => {
  const { SAMPLE_URL } = Cypress.categorizeApi;

  it('responde 200 con estructura completa para el ejemplo de documentacion', () => {
    cy.categorizeRequest({ body: { url: SAMPLE_URL } }).then((response) => {
      expect(response.status).to.eq(200);
      cy.assertCategorizeSuccessShape(response.body, 'documentacion');

      const categories = response.body.domain.categories;
      expect(categories.length).to.be.greaterThan(1);
      for (let i = 1; i < categories.length; i += 1) {
        expect(categories[i - 1].confidence, 'confidence desc').to.be.at.least(categories[i].confidence);
      }

      const company = response.body.objects?.company;
      if (company) {
        expect(company.name, 'company.name').to.be.a('string').and.not.be.empty;
        expect(company.countryCode, 'company.countryCode').to.match(/^[A-Z]{2}$/);
        expect(company.tech, 'company.tech').to.be.an('array');
      }
    });
  });

  it('soporta GET con url en query string', () => {
    cy.categorizeRequest({
      method: 'GET',
      query: `url=${encodeURIComponent(SAMPLE_URL)}`
    }).then((response) => {
      expect(response.status).to.eq(200);
      cy.assertCategorizeSuccessShape(response.body, 'GET');
    });
  });
});

describe('POST /api/categorize - autenticacion', () => {
  const { SAMPLE_URL } = Cypress.categorizeApi;

  const assertUnauthorized = (response, label) => {
    expect(response.status, `${label}: status`).to.eq(401);
    expect(response.body.success, `${label}: success`).to.eq(false);
    expect(response.body.error, `${label}: error`).to.eq('Unauthorized');
  };

  it('rechaza solicitudes sin header Authorization', () => {
    cy.categorizeRequest({ body: { url: SAMPLE_URL }, authorization: false }).then((response) => {
      assertUnauthorized(response, 'sin header');
    });
  });

  it('rechaza token invalido', () => {
    cy.categorizeRequest({
      body: { url: SAMPLE_URL },
      authorization: 'Bearer token.invalido'
    }).then((response) => {
      assertUnauthorized(response, 'token invalido');
    });
  });

  it('rechaza Authorization sin prefijo Bearer', () => {
    cy.categorizeRequest({
      body: { url: SAMPLE_URL },
      authorization: Cypress.categorizeApi.getApiKey()
    }).then((response) => {
      assertUnauthorized(response, 'sin Bearer');
    });
  });
});

describe('POST /api/categorize - validacion de entrada', () => {
  const { assertValidationFailure } = Cypress.categorizeApi;

  const invalidUrlCases = [
    {
      name: 'sin url',
      body: {},
      expectMessage: (message) => expect(message.url).to.include('The url field is required.')
    },
    {
      name: 'url vacia',
      body: { url: '' },
      expectMessage: (message) => expect(message.url).to.include('The url field is required.')
    },
    {
      name: 'dominio sin protocolo',
      body: { url: 'cbsnews.com' },
      expectMessage: (message) => expect(message.url).to.include('The url must be a valid URL.')
    },
    {
      name: 'url invalida',
      body: { url: 'not-a-url' },
      expectMessage: (message) => expect(message.url).to.include('The url must be a valid URL.')
    }
  ];

  it('rechaza entradas de URL invalidas con success false', () => {
    cy.wrap(invalidUrlCases).each((testCase) => {
      cy.categorizeRequest({ body: testCase.body, timeout: 30000 }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        assertValidationFailure(response.body, testCase.name);
        testCase.expectMessage(response.body.message);
      });
    });
  });

  it('rechaza email invalido con success false', () => {
    cy.categorizeRequest({ body: { email: 'not-an-email' }, timeout: 30000 }).then((response) => {
      expect(response.status).to.eq(200);
      assertValidationFailure(response.body, 'email invalido');
      expect(response.body.message).to.include('Email address is invalid');
    });
  });

  it('detecta que errores de validacion devuelven 200 en lugar de 422', () => {
    cy.categorizeRequest({ body: { url: 'not-a-url' } }).then((response) => {
      expect(response.body.success).to.eq(false);
      expect(
        response.status,
        'Mejora sugerida: errores de validacion deberian devolver 422, no 200.'
      ).to.eq(200);
    });
  });
});

describe('POST /api/categorize - edge cases y mejoras de API', () => {
  const { hasMeaningfulError, isSuccessfulCategorize, SAMPLE_URL } = Cypress.categorizeApi;

  it('marca dominios inalcanzables con categoria /Unreachable y success true (mejora semantica)', () => {
    cy.categorizeRequest({
      body: { url: 'https://thisdomaindoesnotexist12345xyz.com' }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.domain.categories[0].name).to.eq('/Unreachable');

      if (response.body.success === true || response.body.success === undefined) {
        cy.log(
          'Mejora sugerida: /Unreachable deberia responder success:false o incluir un campo error explicito.'
        );
      }
    });
  });

  it('detecta entradas invalidas que provocan 500 o se ignoran silenciosamente', () => {
    const riskyCases = [
      {
        name: 'url numerica',
        body: { url: 12345 },
        assert: (response) => {
          const crashed = response.status === 500;
          const meaningfulError = hasMeaningfulError(response);
          expect(
            crashed || meaningfulError,
            'url numerica deberia devolver 422, no 500 ni payload exitoso.'
          ).to.eq(true);
        }
      },
      {
        name: 'parametro desconocido',
        body: { url: SAMPLE_URL, foo: 'bar' },
        assert: (response) => {
          expect(response.status).to.eq(200);
          expect(isSuccessfulCategorize(response.body)).to.eq(true);
          cy.log('Mejora sugerida: parametro desconocido "foo" se ignora sin aviso.');
        }
      },
      {
        name: 'JSON malformado',
        rawBody: '{bad json}',
        assert: (response) => {
          expect(response.body.success).to.eq(false);
          cy.log('Mejora sugerida: JSON malformado devuelve 200 con "url required" en lugar de 400.');
        }
      }
    ];

    cy.wrap(riskyCases).each((testCase) => {
      cy.categorizeRequest({
        body: testCase.body,
        rawBody: testCase.rawBody
      }).then((response) => {
        testCase.assert(response, testCase.name);
      });
    });
  });

  it('documenta formato de mensajes de validacion anidados', () => {
    cy.categorizeRequest({ body: {} }).then((response) => {
      expect(response.body.message).to.be.an('object');
      expect(response.body.message.url).to.be.an('array');
      cy.log(
        'Mejora sugerida: message es un objeto anidado {"url":["..."]} en lugar de un string plano.'
      );
    });
  });
});
