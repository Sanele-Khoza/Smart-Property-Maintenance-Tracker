import * as service from './backup.service.js';

const exportData = async (req, res, next) => {
  try {
    const result = await service.exportData();
    res.json(result);
  } catch (err) { next(err); }
};

const importData = async (req, res, next) => {
  try {
    const result = await service.importData(req.body);
    res.json(result);
  } catch (err) { next(err); }
};

export { exportData, importData };
