# JARVIS v4 build report

## Source validation

- Repository converted from ZIP-only to reviewable root source tree.
- Node.js requirement: >=22.
- Regression tests cover arithmetic, reserved-network filtering, and protocol approval boundaries.
- API routes enforce same-origin, session authentication, rate limits, body-size limits, and abort propagation.
- Browser navigation is restricted by HTTPS, allowlist, and DNS public-address checks.

## Runtime verification

A complete Next.js production build still requires dependency installation in a network-enabled environment. This sandbox cannot reliably complete npm dependency installation, so no claim of a successful production compile is made here.

## Deployment checklist

1. Configure all variables from .env.example.
2. Run npm install.
3. Run npm test.
4. Run npm run build.
5. Verify Vercel project root points to the repository root.
6. Add real connector integrations only behind explicit approval paths.
