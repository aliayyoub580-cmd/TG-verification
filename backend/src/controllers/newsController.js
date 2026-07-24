const service = require('../services/newsService');

async function list(req, res, next) {
  try {
    const result = await service.listNews(req.query);
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
}

async function getOne(req, res, next) {
  try {
    res.json({ success: true, data: await service.getNewsById(req.params.id) });
  } catch (error) { next(error); }
}

async function refresh(req, res, next) {
  try {
    const result = await service.refreshNews();
    res.json({ success: true, data: result, message: `${result.inserted} news articles refreshed` });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    await service.deleteNews(req.params.id);
    res.json({ success: true, message: 'News article deleted' });
  } catch (error) { next(error); }
}

module.exports = { list, getOne, refresh, remove };
