import { query } from '../../db/connection.js';

const SPECIALISATION_WEIGHT = 0.25;
const RATING_WEIGHT = 0.30;
const PROXIMITY_WEIGHT = 0.25;
const WORKLOAD_WEIGHT = 0.20;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcSpecScore(providerSpecs, ticketCategory) {
  if (!providerSpecs || providerSpecs.length === 0) return 0;
  const lowerSpecs = providerSpecs.map(s => s.toLowerCase());
  const lowerCat = (ticketCategory || '').toLowerCase();
  if (lowerSpecs.some(s => s === lowerCat || s.includes(lowerCat) || lowerCat.includes(s))) return 1;
  return 0;
}

async function resolveTicketLocation(ticket) {
  let ticketLat = null;
  let ticketLng = null;
  if (ticket.unit_id) {
    const result = await query(
      `SELECT u.*, p.name AS property_name,
              p.address AS property_address
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.id = $1`,
      [ticket.unit_id]
    );
    if (result.rows[0]) {
      const row = result.rows[0];
      if (row.gps_location) {
        ticketLat = row.gps_location.x;
        ticketLng = row.gps_location.y;
      }
    }
  }
  return { ticketLat, ticketLng };
}

async function scoreProviders(ticket, opts = {}) {
  const {
    excludeOffDuty = true,
    topN = 3,
    requireSpecialisation = false,
    category = ticket.category || ticket.ai_category || 'Other',
  } = opts;

  const { ticketLat, ticketLng } = await resolveTicketLocation(ticket);

  let sql = `SELECT sp.*,
              COALESCE(sp.rating, 0) AS rating,
              COALESCE(sp.current_workload, 0) AS workload,
              COALESCE(sp.specialisations, '{}') AS specialisations,
              pa.auto_accept, pa.current_jobs AS pa_jobs,
              pa.max_concurrent_jobs, pa.is_available AS pa_available
             FROM service_providers sp
             LEFT JOIN provider_availability pa ON pa.provider_id = sp.id`;
  const params = [];
  const clauses = [];

  if (excludeOffDuty) {
    clauses.push("sp.status != 'OFF_DUTY'");
  }
  if (requireSpecialisation) {
    clauses.push(`sp.specialisations IS NOT NULL AND array_length(sp.specialisations, 1) > 0`);
  }

  if (clauses.length > 0) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY sp.rating DESC';

  const providers = (await query(sql, params)).rows;
  if (providers.length === 0) return [];

  const maxRating = Math.max(...providers.map(p => p.rating || 0), 1);
  const maxWorkload = Math.max(...providers.map(p => (p.workload || 0) + (p.pa_jobs || 0)), 1);

  const scored = providers.map(p => {
    const rawSpecs = p.specialisations || [];
    const specs = Array.isArray(rawSpecs)
      ? rawSpecs
      : typeof rawSpecs === 'string' ? JSON.parse(rawSpecs) : [];

    const specScore = SPECIALISATION_WEIGHT * calcSpecScore(specs, category);
    const ratingScore = RATING_WEIGHT * ((p.rating || 0) / maxRating);

    let proximityScore = 0;
    if (ticketLat != null && ticketLng != null && p.gps_location) {
      const gps = p.gps_location;
      const distance = haversineKm(ticketLat, ticketLng, gps.x || ticketLat, gps.y || ticketLng);
      const normalizedDistance = Math.min(distance / (p.preferred_radius_km || 50), 1);
      proximityScore = PROXIMITY_WEIGHT * (1 - normalizedDistance);
    } else {
      proximityScore = PROXIMITY_WEIGHT * 0.5;
    }

    const totalWorkload = (p.workload || 0) + (p.pa_jobs || 0);
    const workloadScore = WORKLOAD_WEIGHT * (1 - totalWorkload / maxWorkload);

    const totalScore = specScore + ratingScore + proximityScore + workloadScore;

    return {
      id: p.id,
      name: p.name,
      companyName: p.company_name,
      specialisations: specs,
      rating: p.rating,
      workload: totalWorkload,
      status: p.status,
      autoAccept: p.auto_accept || false,
      totalScore: Math.round(totalScore * 100) / 100,
      specScore: Math.round(specScore * 100) / 100,
      ratingScore: Math.round(ratingScore * 100) / 100,
      proximityScore: Math.round(proximityScore * 100) / 100,
      workloadScore: Math.round(workloadScore * 100) / 100,
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored.slice(0, topN);
}

export { scoreProviders, haversineKm, calcSpecScore };
