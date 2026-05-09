// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId, playerIndex } = event

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

    // 检查玩家是否存在
    if (playerIndex < 0 || playerIndex >= room.players.length) {
      return {
        success: false,
        error: '玩家不存在'
      }
    }

    // 删除玩家
    const updatedPlayers = room.players.filter((_, index) => index !== playerIndex)

    // 从分数表中删除该玩家的分数列
    const updatedScores = room.scores.map(round => {
      const newRound = [...round]
      newRound.splice(playerIndex, 1)
      return newRound
    })

    // 如果删除后没有玩家了，自动解散房间（删除房间）
    if (updatedPlayers.length === 0) {
      await db.collection('rooms').doc(roomId).remove()
      return {
        success: true,
        roomDeleted: true
      }
    }

    // 否则只更新玩家列表和分数
    await db.collection('rooms').doc(roomId).update({
      data: {
        players: updatedPlayers,
        scores: updatedScores,
        updateTime: new Date()
      }
    })

    return {
      success: true,
      roomDeleted: false
    }
  } catch (err) {
    console.error('删除玩家失败:', err)
    return {
      success: false,
      error: '删除玩家失败: ' + err.message
    }
  }
}