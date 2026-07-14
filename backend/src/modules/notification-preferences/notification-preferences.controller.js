import { query } from '../../db/connection.js';

const CHANNELS = ['in_app', 'email', 'push'];

const getPreferences = async (req, res, next) => {
  try {
    let prefs = await query(
      'SELECT channel, enabled FROM notification_channel_preferences WHERE user_id = $1',
      [req.user.id]
    );
    let result = prefs.rows;
    if (result.length === 0) {
      for (const ch of CHANNELS) {
        await query(
          'INSERT INTO notification_channel_preferences (user_id, channel, enabled) VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING',
          [req.user.id, ch]
        );
      }
      result = CHANNELS.map(ch => ({ channel: ch, enabled: true }));
    }
    res.json({ success: true, data: { preferences: result } });
  } catch (err) { next(err); }
};

const updatePreference = async (req, res, next) => {
  try {
    const { channel, enabled } = req.body;
    if (!CHANNELS.includes(channel)) {
      return res.status(400).json({ success: false, error: { message: `Invalid channel. Must be one of: ${CHANNELS.join(', ')}` } });
    }
    await query(
      'INSERT INTO notification_channel_preferences (user_id, channel, enabled) VALUES ($1, $2, $3) ON CONFLICT (user_id, channel) DO UPDATE SET enabled = $3',
      [req.user.id, channel, !!enabled]
    );
    const prefs = await query('SELECT channel, enabled FROM notification_channel_preferences WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, data: { preferences: prefs.rows }, message: `${channel} ${enabled ? 'enabled' : 'disabled'}` });
  } catch (err) { next(err); }
};

export { getPreferences, updatePreference };
