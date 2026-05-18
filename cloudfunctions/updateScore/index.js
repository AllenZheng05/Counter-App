// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId, roundIndex, playerIndex, score } = event

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

    // 检查局数和玩家是否存在
    if (roundIndex < 0 || roundIndex >= room.scores.length) {
      return {
        success: false,
        error: '局数不存在'
      }
    }

    if (playerIndex < 0 || playerIndex >= room.players.length) {
      return {
        success: false,
        error: '玩家不存在'
      }
    }

    // 更新分数
    const updatedScores = [...room.scores]
    const updatedRound = [...updatedScores[roundIndex]]
    updatedRound[playerIndex] = score
    updatedScores[roundIndex] = updatedRound

    await db.collection('rooms').doc(roomId).update({
      data: {
        scores: updatedScores,
        updateTime: new Date()
      }
    })

    return {
      success: true
    }
  } catch (err) {
    console.error('更新分数失败:', err)
    return {
      success: false,
      error: '更新分数失败: ' + err.message
    }
  }
}