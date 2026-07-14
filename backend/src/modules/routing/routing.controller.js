import * as svc from './routing.service.js';

const getTopProviders = async (req, res, next) => {
  try {
    const opts = req.query;
    const result = await svc.getTopProviders(req.params.ticketId, opts);
    res.json(result);
  } catch (err) { next(err); }
};

const autoAssign = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await svc.autoAssign(
      req.params.ticketId, req.user.id, name, req.body.requireSpecialisation
    );
    res.json(result);
  } catch (err) { next(err); }
};

const dispatchEmergency = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await svc.dispatchEmergency(
      req.params.ticketId, req.user.id, name, req.body
    );
    res.json(result);
  } catch (err) { next(err); }
};

const accept = async (req, res, next) => {
  try {
    const result = await svc.accept(
      req.params.assignmentId, req.body.providerId, req.user.id
    );
    if (result.error) {
      return res.status(result.statusCode).json({ success: false, error: result.error });
    }
    res.json(result);
  } catch (err) { next(err); }
};

const manualAssign = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await svc.manualAssign(
      req.params.ticketId, req.body.providerId, req.user.id, name, req.body.note
    );
    res.json(result);
  } catch (err) { next(err); }
};

const getAssignmentHistory = async (req, res, next) => {
  try {
    const history = await svc.getAssignmentHistory(req.params.ticketId);
    res.json({ success: true, data: { history } });
  } catch (err) { next(err); }
};

const getProviderStatus = async (req, res, next) => {
  try {
    const status = await svc.getProviderStatus(req.params.providerId);
    res.json({ success: true, data: { status } });
  } catch (err) { next(err); }
};

export {
  getTopProviders,
  autoAssign,
  dispatchEmergency,
  accept,
  manualAssign,
  getAssignmentHistory,
  getProviderStatus,
};
