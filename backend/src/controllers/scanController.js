const { listScans, getScanById, exportScans, getDashboardStats } = require('../services/scanService');
const { paginatedResponse } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { data, total, page, limit } = await listScans(req.query);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const scan = await getScanById(req.params.id);
    res.json({ success: true, data: scan });
  } catch (err) {
    next(err);
  }
}

async function exportHistory(req, res, next) {
  try {
    const csv = await exportScans({
      result: req.query.result,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="scan-history-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

async function dashboard(req, res, next) {
  try {
    const stats = await getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, exportHistory, dashboard };
