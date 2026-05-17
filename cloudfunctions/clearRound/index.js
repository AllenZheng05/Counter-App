const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId, roundIndex } = event

  try {
    const roomResult = await db.collection('rooms').doc(roomId).get()

    if (!roomResult.data) {
      return { success: false, error: '房间不存在' }
    }

    const room = roomResult.data
    const idx = Number(roundIndex)

    if (idx < 0 || idx >= (room.scores || []).length) {
      return { success: false, error: '局数不存在' }
    }

    const updatedScores = room.scores.map((round, i) =>
      i === idx ? round.map(() => 0) : round
    )

    await db.collection('rooms').doc(roomId).update({
      data: { scores: updatedScores, updateTime: new Date() }
    })

    return { success: true }
  } catch (err) {
    console.error('清空局数失败:', err)
    return { success: false, error: err.message }
  }
}
