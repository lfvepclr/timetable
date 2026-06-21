// lib/query.js — JSON where 条件 → SQL WHERE 翻译
// 支持 $gte/$lte/$gt/$lt/$ne/$in/$regex/$and/$or + JSON 列点号路径

/**
 * 构建 WHERE 子句
 * @param {string} table 表名（用于判断 JSON 列）
 * @param {object} where 查询条件
 * @returns {{ clause: string, params: array }}
 */
function buildWhere(table, where) {
  if (!where || Object.keys(where).length === 0) {
    return { clause: '', params: [] }
  }

  const conditions = []
  const params = []

  for (const [field, value] of Object.entries(where)) {
    // $and / $or 顶层逻辑
    if (field === '$and') {
      const subClauses = value.map(v => buildWhere(table, v))
      const joined = subClauses.filter(s => s.clause).map(s => `(${s.clause})`).join(' AND ')
      if (joined) conditions.push(`(${joined})`)
      subClauses.forEach(s => params.push(...s.params))
      continue
    }
    if (field === '$or') {
      const subClauses = value.map(v => buildWhere(table, v))
      const joined = subClauses.filter(s => s.clause).map(s => `(${s.clause})`).join(' OR ')
      if (joined) conditions.push(`(${joined})`)
      subClauses.forEach(s => params.push(...s.params))
      continue
    }

    // 点号路径：JSON 列内查询（如 parents.openid）
    if (field.includes('.')) {
      const [col, ...pathParts] = field.split('.')
      const jsonPath = '$.' + pathParts.join('.')
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 操作符
        if (value.$ne !== undefined) {
          conditions.push(`NOT EXISTS (SELECT 1 FROM json_each(${col}) WHERE json_extract(json_each.value, '${jsonPath}') = ?)`)
          params.push(value.$ne)
        } else if (value.$in) {
          const placeholders = value.$in.map(() => '?').join(',')
          conditions.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE json_extract(json_each.value, '${jsonPath}') IN (${placeholders}))`)
          params.push(...value.$in)
        } else {
          // 等值
          conditions.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE json_extract(json_each.value, '${jsonPath}') = ?)`)
          params.push(value)
        }
      } else {
        conditions.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE json_extract(json_each.value, '${jsonPath}') = ?)`)
        params.push(value)
      }
      continue
    }

    // 普通字段
    const col = field === '_id' ? 'id' : field

    if (value === null || value === undefined) {
      conditions.push(`${col} IS NULL`)
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // 操作符对象
      if (value.$gte !== undefined) { conditions.push(`${col} >= ?`); params.push(value.$gte) }
      if (value.$lte !== undefined) { conditions.push(`${col} <= ?`); params.push(value.$lte) }
      if (value.$gt !== undefined) { conditions.push(`${col} > ?`); params.push(value.$gt) }
      if (value.$lt !== undefined) { conditions.push(`${col} < ?`); params.push(value.$lt) }
      if (value.$ne !== undefined) { conditions.push(`${col} != ?`); params.push(value.$ne) }
      if (value.$in) {
        const placeholders = value.$in.map(() => '?').join(',')
        conditions.push(`${col} IN (${placeholders})`)
        params.push(...value.$in)
      }
      if (value.$regex) {
        const pattern = String(value.$regex).replace(/\.\*/g, '%').replace(/\./g, '_')
        conditions.push(`${col} LIKE ?`)
        params.push(`%${value.$regex}%`)
      }
    } else {
      // 等值
      conditions.push(`${col} = ?`)
      params.push(value)
    }
  }

  return {
    clause: conditions.length > 0 ? conditions.join(' AND ') : '',
    params,
  }
}

/**
 * 构建 ORDER BY 子句
 * @param {array} orderBy [field, direction]
 * @returns {string}
 */
function buildOrderBy(orderBy) {
  if (!orderBy || !Array.isArray(orderBy)) return ''
  const [field, direction] = orderBy
  const col = field === '_id' ? 'id' : field
  return `ORDER BY ${col} ${direction === 'desc' ? 'DESC' : 'ASC'}`
}

/**
 * 构建 LIMIT/OFFSET
 */
function buildLimit(page, pageSize) {
  const offset = (page - 1) * pageSize
  return `LIMIT ${pageSize} OFFSET ${offset}`
}

module.exports = { buildWhere, buildOrderBy, buildLimit }
