const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    const roomResult = await db.collection('rooms').doc(roomId).get()

    if (!roomResult.data) {
      return { success: false, error: '房间不存在' }
    }

    const validScores = (roomResult.data.scores || []).filter(r => Array.isArray(r))

    if (validScores.length === 0) {
      return { success: false, error: '没有可以删除的局数' }
    }

    await db.collection('rooms').doc(roomId).update({
      data: {
        scores: validScores.slice(0, -1),
        updateTime: new Date()
      }
    })

    return { success: true }
  } catch (err) {
    console.error('删除局数失败:', err)
    return { success: false, error: '删除局数失败: ' + err.message }
  }
}
