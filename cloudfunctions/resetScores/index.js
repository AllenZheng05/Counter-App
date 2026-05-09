// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId } = event

  try {
    // 获取房间信息
    const roomResult = await db.collection('rooms').doc(roomId).get()
    
    if (!roomResult.data) {
      return {
        success: false,
        error: '房间不存在'
      }
    }

    const room = roomResult.data

    // 重置所有分数为0，保留玩家信息和局数结构
    const resetScores = room.scores.map(round => round.map(() => 0))

    await db.collection('rooms').doc(roomId).update({
      data: {
        scores: resetScores,
        updateTime: new Date()
      }
    })

    return {
      success: true
    }
  } catch (err) {
    console.error('重置分数失败:', err)
    return {
      success: false,
      error: '重置分数失败: ' + err.message
    }
  }
}