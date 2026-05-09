// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { roomName, maxPlayers, inviteCode, creator } = event

  try {
    // 检查邀请码是否已存在
    const existRoom = await db.collection('rooms').where({
      inviteCode: inviteCode
    }).get()

    if (existRoom.data.length > 0) {
      return {
        success: false,
        error: '邀请码已存在，请重试'
      }
    }

    // 创建房间
    const createTime = new Date()
    const result = await db.collection('rooms').add({
      data: {
        roomName: roomName,
        inviteCode: inviteCode,
        maxPlayers: maxPlayers || 8,
        creatorId: wxContext.OPENID,
        creator: creator,
        players: [{
          id: generateUUID(),
          name: '房主',
          userId: wxContext.OPENID,
          isCreator: true
        }],
        scores: [],  // 二维数组 [roundIndex][playerIndex]
        createTime: createTime,
        updateTime: createTime
      }
    })

    return {
      success: true,
      _id: result._id
    }
  } catch (err) {
    console.error('创建房间失败:', err)
    return {
      success: false,
      error: '创建房间失败: ' + err.message
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