import { query } from '../../db/connection.js';

const search = async (req, res, next) => {
  try {
    const q = req.query.q;
    const entityFilter = req.query.type;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: { tickets: [], properties: [], units: [], users: [], serviceProviders: [], documents: [] } });
    }

    const likeTerm = `%${q}%`;
    const tsQuery = q.split(/\s+/).filter(Boolean).map(w => w + ':*').join(' & ');

    const queries = {};

    if (!entityFilter || entityFilter === 'tickets') {
      queries.tickets = query(
        `SELECT id, title, status, priority, category, created_at,
                ts_rank(to_tsvector('english', title || ' ' || description), to_tsquery('english', $2)) AS rank
         FROM tickets
         WHERE deleted_at IS NULL
            AND (to_tsvector('english', title || ' ' || description) @@ to_tsquery('english', $2)
            OR title ILIKE $1 OR description ILIKE $1)
         ORDER BY rank DESC NULLS LAST
         LIMIT 10`,
        [likeTerm, tsQuery]
      ).then(r => r.rows);
    }

    if (!entityFilter || entityFilter === 'properties') {
      queries.properties = query(
        `SELECT id, name, type, status FROM properties WHERE name ILIKE $1 OR address ILIKE $1 LIMIT 10`,
        [likeTerm]
      ).then(r => r.rows);
    }

    if (!entityFilter || entityFilter === 'units') {
      queries.units = query(
        `SELECT id, unit_number, status FROM units WHERE unit_number ILIKE $1 LIMIT 10`,
        [likeTerm]
      ).then(r => r.rows);
    }

    if (!entityFilter || entityFilter === 'users') {
      queries.users = query(
        `SELECT id, name, surname, email, role FROM users WHERE name ILIKE $1 OR surname ILIKE $1 OR email ILIKE $1 LIMIT 10`,
        [likeTerm]
      ).then(r => r.rows);
    }

    if (!entityFilter || entityFilter === 'serviceProviders') {
      queries.serviceProviders = query(
        `SELECT id, name, company_name, email, status, specialisations
         FROM service_providers
         WHERE name ILIKE $1 OR company_name ILIKE $1 OR email ILIKE $1
         LIMIT 10`,
        [likeTerm]
      ).then(r => r.rows);
    }

    if (!entityFilter || entityFilter === 'documents') {
      queries.documents = query(
        `SELECT id, filename, mime_type, created_at FROM documents WHERE filename ILIKE $1 LIMIT 10`,
        [likeTerm]
      ).then(r => r.rows);
    }

    const results = await Promise.allSettled(Object.entries(queries).map(([key, promise]) =>
      promise.then(data => ({ key, data }))
    ));

    const data = { tickets: [], properties: [], units: [], users: [], serviceProviders: [], documents: [] };
    for (const result of results) {
      if (result.status === 'fulfilled') {
        data[result.value.key] = result.value.data;
      }
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export { search };
