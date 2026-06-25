describe('POST /api/discovery - casos positivos', () => {
  const { techMatches } = Cypress.discoveryApi;

  const validCases = [
    {
      name: 'ejemplo documentacion (Shopping + US + Shopify)',
      body: {
        top_n: 100000,
        filters: { category: 'Shopping', country: 'US', tech: 'Shopify' },
        page: 1
      }
    },
    {
      name: 'solo top_n',
      body: { top_n: 1000, page: 1 }
    },
    {
      name: 'body vacio (defaults del servidor)',
      body: {}
    },
    {
      name: 'busqueda textual q=amazon',
      body: { top_n: 100000, q: 'amazon', page: 1 }
    },
    {
      name: 'filtros completos documentados',
      body: {
        top_n: 100000,
        filters: {
          category: 'Shopping',
          country: 'US',
          tech: 'shopify',
          employees: '50K-100K',
          tld: 'com',
          has_company: true
        },
        q: 'shop',
        page: 1,
        sort: 'monthly_visits_latest',
        sort_dir: 'desc'
      }
    },
    {
      name: 'alias de pais UK -> GB',
      body: { top_n: 10000, filters: { country: 'UK' }, page: 1 }
    },
    {
      name: 'tech case-insensitive (WORDPRESS)',
      body: { top_n: 50000, filters: { tech: 'WORDPRESS' }, page: 1 }
    },
    {
      name: 'sort por domain asc',
      body: { top_n: 5000, sort: 'domain', sort_dir: 'asc', page: 1 }
    },
    {
      name: 'sort por company_name desc',
      body: { top_n: 5000, sort: 'company_name', sort_dir: 'desc', page: 1 }
    },
    {
      name: 'sort por popularity_score',
      body: { top_n: 5000, sort: 'popularity_score', sort_dir: 'desc', page: 1 }
    },
    {
      name: 'filtro tld co.uk',
      body: { top_n: 100000, filters: { tld: 'co.uk' }, page: 1 }
    },
    {
      name: 'sin top_n (sin techo de ranking)',
      body: { filters: { category: 'News' }, page: 1 }
    }
  ];

  it('responde 200 con estructura consistente para combinaciones validas', () => {
    cy.wrap(validCases).each((testCase) => {
      cy.discoveryRequest({ body: testCase.body }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        cy.assertDiscoveryShape(response.body, testCase.name);
      });
    });
  });

  it('respeta paginacion: pagina 2 difiere de pagina 1', () => {
    const baseBody = { top_n: 50000, page: 1 };

    cy.discoveryRequest({ body: baseBody }).then((pageOne) => {
      expect(pageOne.status).to.eq(200);
      expect(pageOne.body.results.length).to.eq(100);

      cy.discoveryRequest({ body: { ...baseBody, page: 2 } }).then((pageTwo) => {
        expect(pageTwo.status).to.eq(200);
        expect(pageTwo.body.page).to.eq(2);
        expect(pageTwo.body.results.length).to.eq(100);
        expect(pageTwo.body.results[0].domain).to.not.eq(pageOne.body.results[0].domain);
      });
    });
  });

  it('aplica filtros sobre resultados cuando hay coincidencias', () => {
    const filterChecks = [
      {
        name: 'category Shopping',
        body: {
          top_n: 100000,
          filters: { category: 'Shopping', country: 'US', tech: 'shopify' },
          page: 1
        },
        assert: (item) => {
          expect(item.primary_category || '').to.match(/Shopping/i);
          expect(item.company_country).to.eq('US');
          expect(techMatches(item.tech_stack, 'shopify')).to.eq(true);
        }
      },
      {
        name: 'has_company true',
        body: { top_n: 5000, filters: { has_company: true }, page: 1 },
        assert: (item) => {
          expect(item.company_name, 'company_name presente').to.be.a('string').and.not.to.be.empty;
        }
      },
      {
        name: 'tld com',
        body: { top_n: 100000, filters: { tld: 'com' }, page: 1 },
        assert: (item) => {
          expect(item.domain).to.match(/\.com$/i);
        }
      },
      {
        name: 'q amazon',
        body: { top_n: 100000, q: 'amazon', page: 1 },
        assert: (item) => {
          const haystack = `${item.domain} ${item.company_name || ''} ${item.primary_category || ''}`.toLowerCase();
          expect(haystack).to.include('amazon');
        }
      }
    ];

    cy.wrap(filterChecks).each((check) => {
      cy.discoveryRequest({ body: check.body }).then((response) => {
        expect(response.status, `${check.name}: status`).to.eq(200);
        expect(response.body.total, `${check.name}: total`).to.be.greaterThan(0);
        expect(response.body.results.length, `${check.name}: results`).to.be.greaterThan(0);

        response.body.results.slice(0, 5).forEach((item, index) => {
          check.assert(item, `${check.name}[${index}]`);
        });
      });
    });
  });

  it('ordena por monthly_visits_latest desc cuando se solicita', () => {
    cy.discoveryRequest({
      body: {
        top_n: 10000,
        sort: 'monthly_visits_latest',
        sort_dir: 'desc',
        page: 1
      }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.results.length).to.be.greaterThan(1);

      const visits = response.body.results
        .map((item) => item.monthly_visits)
        .filter((value) => typeof value === 'number');

      if (visits.length > 1) {
        for (let i = 1; i < visits.length; i += 1) {
          expect(visits[i - 1], 'visits orden desc').to.be.at.least(visits[i]);
        }
      }
    });
  });

  it('mantiene coherencia entre total, total_pages y page', () => {
    cy.discoveryRequest({
      body: { top_n: 100000, filters: { category: 'Shopping', country: 'US' }, page: 1 }
    }).then((response) => {
      const { total, total_pages, page, results } = response.body;
      const expectedPages = Math.min(1000, Math.ceil(total / 100));

      expect(page).to.eq(1);
      expect(total_pages).to.eq(expectedPages);
      expect(results.length).to.be.at.most(100);

      if (total === 0) {
        expect(results).to.have.length(0);
        expect(total_pages).to.eq(0);
      }
    });
  });
});

describe('POST /api/discovery - autenticacion y metodo HTTP', () => {
  it('rechaza solicitudes sin credenciales validas', () => {
    const authCases = [
      { name: 'sin header Authorization', authorization: false },
      { name: 'token invalido', authorization: 'Bearer token.invalido' },
      { name: 'sin prefijo Bearer', authorization: Cypress.discoveryApi.getApiKey() }
    ];

    cy.wrap(authCases).each((testCase) => {
      cy.discoveryRequest({
        body: { top_n: 1000 },
        authorization: testCase.authorization
      }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(401);
        expect(response.body.success, `${testCase.name}: success`).to.eq(false);
        expect(response.body.error, `${testCase.name}: error`).to.eq('Unauthorized');
        expect(response.body.message, `${testCase.name}: message`).to.be.a('string').and.not.to.be.empty;
      });
    });
  });

  it('rechaza GET con 405 Method Not Allowed', () => {
    cy.discoveryRequest({ method: 'GET', body: undefined }).then((response) => {
      expect(response.status).to.eq(405);
    });
  });
});

describe('POST /api/discovery - casos negativos y mejoras de API', () => {
  const { hasMeaningfulError, isDefaultUnfilteredPayload } = Cypress.discoveryApi;

  it('devuelve lista vacia (no error) para filtros sin coincidencias', () => {
    const noMatchCases = [
      {
        name: 'categoria inexistente',
        body: { top_n: 1000, filters: { category: 'CategoriaInventadaXYZ' } }
      },
      {
        name: 'pais invalido ZZ',
        body: { top_n: 1000, filters: { country: 'ZZ' } }
      },
      {
        name: 'employees segun docs (51-200) sin matches',
        body: { top_n: 100000, filters: { employees: '51-200' } }
      },
      {
        name: 'combinacion restrictiva sin resultados',
        body: {
          top_n: 100000,
          filters: {
            category: 'Shopping',
            country: 'US',
            tech: 'shopify',
            employees: '51-200',
            tld: 'com'
          },
          q: 'amazon'
        }
      }
    ];

    cy.wrap(noMatchCases).each((testCase) => {
      cy.discoveryRequest({ body: testCase.body }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        expect(response.body.total, `${testCase.name}: total`).to.eq(0);
        expect(response.body.total_pages, `${testCase.name}: total_pages`).to.eq(0);
        expect(response.body.results, `${testCase.name}: results`).to.have.length(0);
      });
    });
  });

  // Documenta deuda de API conocida: estas entradas invalidas devuelven el payload por defecto.
  it('detecta entradas invalidas que deberian responder con error explicito', () => {
    const invalidCases = [
      { name: 'JSON malformado', rawBody: '{bad json}' },
      { name: 'top_n texto', body: { top_n: 'abc' } },
      { name: 'page texto', body: { top_n: 1000, page: 'abc' } },
      { name: 'filters como string', body: { top_n: 1000, filters: 'no-es-objeto' } },
      { name: 'sort no soportado', body: { top_n: 1000, sort: 'campo_inexistente' } },
      { name: 'sort_dir invalido', body: { top_n: 1000, sort_dir: 'sideways' } },
      { name: 'parametro desconocido en raiz', body: { top_n: 1000, foo: 'bar' } }
    ];

    const findings = [];

    cy.wrap(invalidCases).each((testCase) => {
      cy.discoveryRequest({
        body: testCase.body,
        rawBody: testCase.rawBody
      }).then((response) => {
        const body = response.body || {};
        const meaningfulError = hasMeaningfulError(response);
        const silentDefaultPayload = isDefaultUnfilteredPayload(body);

        if (!meaningfulError && silentDefaultPayload) {
          findings.push({
            case: testCase.name,
            status: response.status,
            total: body.total,
            firstDomain: body.results?.[0]?.domain || null,
            improvement:
              'Devolver 400/422 con mensaje de validacion en lugar del payload por defecto (google.com, total~1M).'
          });
        }
      });
    }).then(() => {
      findings.forEach((finding) => {
        cy.log(
          `[MEJORA API] ${finding.case} | status=${finding.status} | total=${finding.total} | first=${finding.firstDomain}`
        );
      });

      expect(
        findings,
        'Se esperaba detectar entradas invalidas que la API acepta silenciosamente.'
      ).to.have.length(invalidCases.length);
    });
  });

  it('documenta normalizaciones silenciosas que conviene explicitar en la API', () => {
    const normalizationCases = [
      {
        name: 'page 0 se normaliza a 1',
        body: { top_n: 1000, page: 0 },
        assert: (body) => expect(body.page).to.eq(1)
      },
      {
        name: 'page > 1000 se limita a 1000',
        body: { top_n: 1000, page: 1001 },
        assert: (body) => expect(body.page).to.eq(1000)
      },
      {
        name: 'top_n negativo se trata como sin limite',
        body: { top_n: -5, page: 1 },
        assert: (body) => expect(body.total).to.be.greaterThan(100000)
      },
      {
        name: 'top_n 0 se trata como sin limite',
        body: { top_n: 0, page: 1 },
        assert: (body) => expect(body.total).to.be.greaterThan(100000)
      },
      {
        name: 'top_n > 1000000 se limita a 1000000',
        body: { top_n: 2000000, page: 1 },
        assert: (body) => expect(body.total).to.be.at.most(1000000)
      }
    ];

    cy.wrap(normalizationCases).each((testCase) => {
      cy.discoveryRequest({ body: testCase.body }).then((response) => {
        expect(response.status, `${testCase.name}: status`).to.eq(200);
        testCase.assert(response.body, testCase.name);
      });
    });
  });

  it('registra discrepancia entre valores employees documentados y almacenados', () => {
    cy.discoveryRequest({
      body: { top_n: 100000, filters: { employees: '51-200' }, page: 1 }
    }).then((documentedValue) => {
      cy.discoveryRequest({
        body: { top_n: 100000, filters: { employees: '50K-100K' }, page: 1 }
      }).then((storedValue) => {
        expect(documentedValue.body.total, 'docs 51-200').to.eq(0);
        expect(storedValue.body.total, 'dato real 50K-100K').to.be.greaterThan(0);

        cy.log(
          'Mejora sugerida: la documentacion lista employees como "51-200", pero los datos usan rangos como "50K-100K".'
        );
      });
    });
  });
});
