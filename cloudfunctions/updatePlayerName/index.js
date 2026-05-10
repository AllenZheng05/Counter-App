// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { roomId, playerIndex, newName } = event

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

    // 只有本人或房主可以改名
    const callerIsOwner = room.creatorId === wxContext.OPENID
    const callerIsPlayer = room.players[playerIndex].userId === wxContext.OPENID
    if (!callerIsOwner && !callerIsPlayer) {
      return {
        success: false,
        error: '无权修改该玩家名称'
      }
    }

    // 更新玩家名称
    const updatedPlayers = [...room.players]
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      name: newName
    }

    await db.collection('rooms').doc(roomId).update({
      data: {
        players: updatedPlayers,
        updateTime: new Date()
      }
    })

    return {
      success: true
    }
  } catch (err) {
    console.error('更新玩家名称失败:', err)
    return {
      success: false,
      error: '更新玩家名称失败: ' + err.message
    }
  }
}