import { HelmetOptions } from 'helmet';

export function buildHelmetOptions(appEnv = process.env.APP_ENV || ''): HelmetOptions {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        // The server-rendered UI currently binds actions with inline
        // onclick/onchange attributes. Helmet otherwise adds
        // `script-src-attr 'none'` and silently disables every button.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: ['staging', 'production'].includes(appEnv)
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false
  };
}
