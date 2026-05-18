const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId, roundScores } = event

  try {
    const roomResult = await db.collection('rooms').doc(roomId).get()

    if (!roomResult.data) {
      return { success: false, error: '房间不存在' }
    }

    const existingScores = (roomResult.data.scores || []).filter(r => Array.isArray(r))
    const updatedScores = [...existingScores, roundScores]

    await db.collection('rooms').doc(roomId).update({
      data: {
        scores: updatedScores,
        updateTime: new Date()
      }
    })

    return { success: true }
  } catch (err) {
    console.error('添加局数失败:', err)
    return { success: false, error: '添加局数失败: ' + err.message }
  }
}
