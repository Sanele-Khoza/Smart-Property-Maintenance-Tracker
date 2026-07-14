import * as aiService from './ai.service.js';

const classify = async (req, res, next) => {
  try {
    const result = await aiService.classifyTicket(req.params.ticketId);
    if (result.error) {
      return res.status(result.statusCode).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getLowConfidenceQueue = async (req, res, next) => {
  try {
    const filters = req.query;
    const result = await aiService.getLowConfidenceQueue(filters);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const reviewQueueItem = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await aiService.reviewQueueItem(req.params.id, status, req.user.id);
    if (result.error) {
      return res.status(result.statusCode).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: { item: result.item }, message: 'Queue item updated' });
  } catch (err) { next(err); }
};

const getEntities = async (req, res, next) => {
  try {
    const entities = await aiService.getEntities(req.params.ticketId);
    res.json({ success: true, data: { entities } });
  } catch (err) { next(err); }
};

const getDuplicates = async (req, res, next) => {
  try {
    const duplicates = await aiService.getDuplicates(req.params.ticketId);
    res.json({ success: true, data: { duplicates } });
  } catch (err) { next(err); }
};

const extractEntities = async (req, res, next) => {
  try {
    const entities = await aiService.extractEntitiesFromText(req.body.text);
    res.json({ success: true, data: { entities } });
  } catch (err) { next(err); }
};

const getQueueStats = async (req, res, next) => {
  try {
    const stats = await aiService.getQueueStats();
    res.json({ success: true, data: { stats } });
  } catch (err) { next(err); }
};

export {
  classify,
  getLowConfidenceQueue,
  reviewQueueItem,
  getEntities,
  getDuplicates,
  extractEntities,
  getQueueStats,
};
