// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId, recordId } = event

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

    // 查找记录
    const recordIndex = room.records.findIndex(r => r.id === recordId)
    if (recordIndex === -1) {
      return {
        success: false,
        error: '记录不存在'
      }
    }

    const record = room.records[recordIndex]

    // 撤销分数：从玩家分数中减去该记录的分数
    const playerIndex = room.players.findIndex(p => p.id === record.playerId)
    if (playerIndex !== -1) {
      const player = room.players[playerIndex]
      const newScore = (player.score || 0) - record.score

      // 更新玩家分数
      const updatedPlayers = [...room.players]
      updatedPlayers[playerIndex] = {
        ...player,
        score: newScore
      }

      // 删除记录
      const updatedRecords = room.records.filter(r => r.id !== recordId)

      await db.collection('rooms').doc(roomId).update({
        data: {
          players: updatedPlayers,
          records: updatedRecords,
          updateTime: new Date()
        }
      })
    }

    return {
      success: true
    }
  } catch (err) {
    console.error('撤销记录失败:', err)
    return {
      success: false,
      error: '撤销记录失败: ' + err.message
    }
  }
}