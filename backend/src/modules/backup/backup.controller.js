import * as service from './backup.service.js';

const exportData = async (req, res, next) => {
  try {
    const result = req.query.format === 'sql'
      ? await service.exportSql()
      : await service.exportData();
    res.json(result);
  } catch (err) { next(err); }
};

const importData = async (req, res, next) => {
  try {
    const mode = req.query.mode === 'merge' ? 'merge' : 'replace';
    const result = await service.importData(req.body, { mode });
    res.json(result);
  } catch (err) { next(err); }
};

const getInfo = async (req, res, next) => {
  try {
    const result = await service.getInfo();
    res.json(result);
  } catch (err) { next(err); }
};

export { exportData, importData, getInfo };
