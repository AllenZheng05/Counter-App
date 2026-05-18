const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    await db.collection('rooms').doc(roomId).update({
      data: {
        scores: db.command.pop(),
        updateTime: new Date()
      }
    })

    return { success: true }
  } catch (err) {
    console.error('删除局数失败:', err)
    return { success: false, error: '删除局数失败: ' + err.message }
  }
}
