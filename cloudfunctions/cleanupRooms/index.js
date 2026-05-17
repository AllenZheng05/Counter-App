const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  // 删除 24 小时内没有任何活动的房间
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000)

  try {
    const result = await db.collection('rooms').where({
      updateTime: _.lt(cutoff)
    }).remove()

    console.log(`清理过期房间完成（2小时无活动），共删除 ${result.stats.removed} 个`)
    return { success: true, removed: result.stats.removed }
  } catch (err) {
    console.error('清理房间失败:', err)
    return { success: false, error: err.message }
  }
}
