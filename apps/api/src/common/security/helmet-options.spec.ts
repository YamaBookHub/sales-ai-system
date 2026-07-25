import { buildHelmetOptions } from './helmet-options';

describe('buildHelmetOptions', () => {
  it('keeps the current inline dashboard actions usable', () => {
    const options = buildHelmetOptions('local');
    const directives = typeof options.contentSecurityPolicy === 'object'
      ? options.contentSecurityPolicy.directives
      : undefined;

    expect(directives).toMatchObject({
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"]
    });
  });

  it('only enables HSTS outside local development', () => {
    expect(buildHelmetOptions('local').strictTransportSecurity).toBe(false);
    expect(buildHelmetOptions('production').strictTransportSecurity).toMatchObject({
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true
    });
  });
});
