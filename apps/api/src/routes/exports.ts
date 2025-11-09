import { FastifyPluginAsync } from 'fastify';
import { mustTenant } from '../auth.js';

const plugin: FastifyPluginAsync = async (app) => {
  // CSV export
  app.get('/export/csv', async (req, rep) => {
    try {
      const tenant = await mustTenant(req);

      const rows = await (app as any).db.crawlEvent.findMany({
        where: { tenantId: tenant.id },
        take: 50000,
        orderBy: { ts: 'desc' },
      });

      if (rows.length === 0) {
        return rep.code(404).send({ error: 'no_events' });
      }

      // Build CSV
      const headers = Object.keys(rows[0]).join(',');
      const body = rows
        .map((r: any) =>
          Object.values(r)
            .map((v) => {
              const str = String(v ?? '');
              // Escape commas and quotes
              return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            })
            .join(',')
        )
        .join('\n');

      rep.header('content-type', 'text/csv');
      rep.header('content-disposition', `attachment; filename="trace-${tenant.domain}.csv"`);
      return rep.send(`${headers}\n${body}`);
    } catch (error: any) {
      return rep.code(401).send({ error: error.message });
    }
  });

  // JSON export
  app.get('/export/json', async (req, rep) => {
    try {
      const tenant = await mustTenant(req);

      const rows = await (app as any).db.crawlEvent.findMany({
        where: { tenantId: tenant.id },
        take: 50000,
        orderBy: { ts: 'desc' },
      });

      rep.header('content-type', 'application/json');
      rep.header('content-disposition', `attachment; filename="trace-${tenant.domain}.json"`);
      return rep.send(rows);
    } catch (error: any) {
      return rep.code(401).send({ error: error.message });
    }
  });
};

export default plugin;
