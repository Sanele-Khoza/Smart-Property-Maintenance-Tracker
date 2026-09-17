import * as chatbotClient from '../../shared/adapters/chatbotClient.js';

const chat = async (req, res, next) => {
  try {
    const { message } = req.validatedBody || req.body || {};
    const role = req.user?.role || null;
    const result = await chatbotClient.ask(message, role);
    if (!result.success) {
      return res.status(503).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.data });
  } catch (err) { next(err); }
};

const health = async (req, res, next) => {
  try {
    const result = await chatbotClient.health();
    const data = result.data || {};
    res.json({ success: result.success, data });
  } catch (err) { next(err); }
};

export { chat, health };