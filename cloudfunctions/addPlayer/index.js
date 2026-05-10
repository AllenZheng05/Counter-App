// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { roomId, playerName } = event

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

    // 验证调用者在该房间中
    const isInRoom = room.players.some(p => p.userId === wxContext.OPENID)
    if (!isInRoom) {
      return {
        success: false,
        error: '无权操作该房间'
      }
    }

    // 检查玩家数量是否已满
    if (room.players.length >= room.maxPlayers) {
      return {
        success: false,
        error: '玩家数量已达上限'
      }
    }

    // 添加新玩家
    const newPlayer = {
      id: generateUUID(),
      name: playerName || `玩家${room.players.length + 1}`,
      userId: wxContext.OPENID,
      isCreator: false
    }

    // 如果有现有的局数，需要为新玩家添加0分
    const updatedScores = (room.scores || []).map(round => [...round, 0])

    await db.collection('rooms').doc(roomId).update({
      data: {
        players: db.command.push(newPlayer),
        scores: updatedScores,
        updateTime: new Date()
      }
    })

    return {
      success: true,
      playerId: newPlayer.id
    }
  } catch (err) {
    console.error('添加玩家失败:', err)
    return {
      success: false,
      error: '添加玩家失败: ' + err.message
    }
  }
}

// 生成UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}