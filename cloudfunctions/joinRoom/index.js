// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { inviteCode, user } = event

  try {
    // 查找房间
    const roomResult = await db.collection('rooms').where({
      inviteCode: inviteCode
    }).get()

    if (roomResult.data.length === 0) {
      return {
        success: false,
        error: '房间不存在'
      }
    }

    const room = roomResult.data[0]

    // 检查房间是否已满
    if (room.players.length >= room.maxPlayers) {
      return {
        success: false,
        error: '房间已满'
      }
    }

    // 检查用户是否已在房间中
    const alreadyInRoom = room.players.some(p => p.userId === wxContext.OPENID)
    if (alreadyInRoom) {
      return {
        success: false,
        error: '你已在该房间中'
      }
    }

    // 添加玩家到房间
    const newPlayer = {
      id: generateUUID(),
      name: user?.nickName || `玩家${room.players.length + 1}`,
      userId: wxContext.OPENID,
      isCreator: false
    }

    await db.collection('rooms').doc(room._id).update({
      data: {
        players: db.command.push(newPlayer),
        updateTime: new Date()
      }
    })

    return {
      success: true,
      room: {
        _id: room._id,
        inviteCode: room.inviteCode,
        roomName: room.roomName
      }
    }
  } catch (err) {
    console.error('加入房间失败:', err)
    return {
      success: false,
      error: '加入房间失败: ' + err.message
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