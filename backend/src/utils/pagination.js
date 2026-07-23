/**
 * Extracts pagination parameters from query string.
 *
 * @param {object} query - req.query
 * @param {number} defaultLimit
 * @returns {{ page: number, limit: number, offset: number }}
 */
function getPagination(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Builds a standard paginated response envelope.
 */
function paginatedResponse(data, total, page, limit) {
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

module.exports = { getPagination, paginatedResponse };
