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

    // 检查是否有可以删除的局数
    if (!room.scores || room.scores.length === 0) {
      return {
        success: false,
        error: '没有可以删除的局数'
      }
    }

    // 删除最后一局
    const updatedScores = room.scores.slice(0, -1)

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
    console.error('删除局数失败:', err)
    return {
      success: false,
      error: '删除局数失败: ' + err.message
    }
  }
}