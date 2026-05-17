// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId, roundScores } = event

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

    // 添加新的一局
    const updatedScores = [...(room.scores || []), roundScores]

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
    console.error('添加局数失败:', err)
    return {
      success: false,
      error: '添加局数失败: ' + err.message
    }
  }
}