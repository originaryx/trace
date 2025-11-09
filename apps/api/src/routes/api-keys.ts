import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { encryptSecret, generateApiSecret, generateApiKeyId } from '../hmac-secrets.js';

const CreateKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

const plugin: FastifyPluginAsync = async (app) => {
  /**
   * POST /v1/settings/api-keys
   *
   * Create a new API key for the tenant.
   * The plaintext secret is shown ONLY ONCE in the response.
   */
  app.post('/v1/settings/api-keys', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const body = CreateKeySchema.parse(req.body);

    // Generate random secret
    const plaintextSecret = generateApiSecret();
    const keyId = generateApiKeyId();

    // Encrypt before storing
    const encryptedSecret = encryptSecret(plaintextSecret);

    // Store in database
    const apiKey = await (app as any).db.apiKey.create({
      data: {
        id: keyId,
        tenantId,
        name: body.name || null,
        secret: encryptedSecret,
      },
    });

    // Return plaintext secret ONCE
    return rep.send({
      id: apiKey.id,
      name: apiKey.name,
      secret: plaintextSecret, // Show once only!
      createdAt: apiKey.createdAt,
      warning: 'Save this secret now. You will not be able to see it again.',
    });
  });

  /**
   * GET /v1/settings/api-keys
   *
   * List all API keys for the tenant (secrets are redacted).
   */
  app.get('/v1/settings/api-keys', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const keys = await (app as any).db.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rep.send({
      keys: keys.map((k: any) => ({
        id: k.id,
        name: k.name,
        createdAt: k.createdAt,
        secretPreview: '••••••••', // Redacted
      })),
    });
  });

  /**
   * DELETE /v1/settings/api-keys/:keyId
   *
   * Revoke an API key.
   */
  app.delete('/v1/settings/api-keys/:keyId', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const { keyId } = req.params as { keyId: string };

    // Verify key belongs to tenant before deleting
    const key = await (app as any).db.apiKey.findFirst({
      where: { id: keyId, tenantId },
    });

    if (!key) {
      return rep.code(404).send({ error: 'key_not_found' });
    }

    await (app as any).db.apiKey.delete({
      where: { id: keyId },
    });

    return rep.send({ success: true, message: 'API key revoked' });
  });

  /**
   * POST /v1/settings/api-keys/:keyId/rotate
   *
   * Rotate an API key (generates new secret, keeps same ID).
   */
  app.post('/v1/settings/api-keys/:keyId/rotate', async (req, rep) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return rep.code(401).send({ error: 'authentication_required' });
    }

    const { keyId } = req.params as { keyId: string };

    // Verify key belongs to tenant
    const key = await (app as any).db.apiKey.findFirst({
      where: { id: keyId, tenantId },
    });

    if (!key) {
      return rep.code(404).send({ error: 'key_not_found' });
    }

    // Generate new secret
    const plaintextSecret = generateApiSecret();
    const encryptedSecret = encryptSecret(plaintextSecret);

    // Update key
    await (app as any).db.apiKey.update({
      where: { id: keyId },
      data: { secret: encryptedSecret },
    });

    return rep.send({
      id: keyId,
      name: key.name,
      secret: plaintextSecret, // Show once only!
      warning: 'Save this new secret now. The old secret is now invalid.',
    });
  });
};

export default plugin;
