import { FastifyPluginAsync } from 'fastify';
import { verifyDetached } from '../eddsa.js';
import { fetchJWKS, getPubKeyByKid } from '../verify-cache.js';

const plugin: FastifyPluginAsync = async (app) => {
  app.post('/verify', async (req, rep) => {
    const { jws, payload } = req.body as any;

    if (!jws) {
      return rep.code(400).send({ ok: false, error: 'missing_jws' });
    }

    try {
      // Parse compact JWS (header.payload.signature)
      const [headerB64, payloadB64, signatureB64] = String(jws).split('.');

      if (!headerB64 || !signatureB64) {
        return rep.code(400).send({ ok: false, error: 'invalid_jws_format' });
      }

      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));

      // Extract kid from header
      const { kid } = header;
      if (!kid) {
        return rep.code(400).send({ ok: false, error: 'missing_kid' });
      }

      // Fetch JWKS and lookup key by kid
      const jwks = await fetchJWKS();
      const key = jwks.keys.find((k) => k.kid === kid);

      if (!key) {
        return rep.code(400).send({ ok: false, error: 'unknown_kid' });
      }

      // Get public key bytes
      const pub = Buffer.from(key.x, 'base64url');

      // Message is either detached payload or embedded payload
      const msg = payload
        ? Buffer.from(payload, 'utf8')
        : Buffer.from(payloadB64 || '', 'base64url');

      const sig = Buffer.from(signatureB64, 'base64url');

      // Verify signature
      const ok = await verifyDetached(sig, msg, pub);

      return rep.send({ ok, header });
    } catch (error: any) {
      return rep.code(400).send({ ok: false, error: error.message });
    }
  });
};

export default plugin;
