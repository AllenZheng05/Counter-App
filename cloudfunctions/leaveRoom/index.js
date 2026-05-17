// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
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
    const players = room.players || []
    const scores = room.scores || []

    // 找到当前用户在玩家列表中的索引
    const playerIndex = players.findIndex(p => p.userId === wxContext.OPENID)
    
    if (playerIndex === -1) {
      // 用户不在房间中，直接返回成功
      return {
        success: true,
        alreadyLeft: true
      }
    }

    // 移除当前用户
    const updatedPlayers = players.filter((_, index) => index !== playerIndex)

    // 从分数表中删除该玩家的分数列
    const updatedScores = scores.map(round => {
      const newRound = [...round]
      newRound.splice(playerIndex, 1)
      return newRound
    })

    // 如果移除后没有玩家了，自动解散房间（删除房间）
    if (updatedPlayers.length === 0) {
      await db.collection('rooms').doc(roomId).remove()
      return {
        success: true,
        roomDeleted: true
      }
    }

    // 如果房主离开，把 creatorId 转让给剩余第一个玩家
    let newCreatorId = room.creatorId
    if (room.creatorId === wxContext.OPENID) {
      newCreatorId = updatedPlayers[0].userId
      updatedPlayers[0] = { ...updatedPlayers[0], isCreator: true }
    }

    await db.collection('rooms').doc(roomId).update({
      data: {
        players: updatedPlayers,
        scores: updatedScores,
        creatorId: newCreatorId,
        updateTime: new Date()
      }
    })

    return {
      success: true,
      roomDeleted: false
    }
  } catch (err) {
    console.error('离开房间失败:', err)
    return {
      success: false,
      error: '离开房间失败: ' + err.message
    }
  }
}
