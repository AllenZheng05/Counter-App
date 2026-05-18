const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId, roundScores } = event

  try {
    await db.collection('rooms').doc(roomId).update({
      data: {
        scores: db.command.push(roundScores),
        updateTime: new Date()
      }
    })

    return { success: true }
  } catch (err) {
    console.error('添加局数失败:', err)
    return { success: false, error: '添加局数失败: ' + err.message }
  }
}
