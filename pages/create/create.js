const app = getApp()

Page({
  data: {
    roomName: '',
    inviteCode: '',
    maxPlayers: 4,
    maxPlayersOptions: [2, 3, 4, 5, 6, 7, 8],
    maxPlayersIndex: 2,  // 默认选中4人（索引2）
    creating: false
  },

  onLoad: function () {
    // 检查是否从分享进入
    const options = this.options
    if (options && options.inviteCode) {
      // 从分享链接进入，直接加入房间
      this.joinByInviteCode(options.inviteCode)
    }
  },

  // 输入房间名称
  onRoomNameInput(e) {
    this.setData({
      roomName: e.detail.value
    })
  },

  // 选择最大玩家数
  onMaxPlayersChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      maxPlayers: parseInt(this.data.maxPlayersOptions[index]),
      maxPlayersIndex: index
    })
  },

  // 创建房间
  createRoom() {
    if (!this.data.roomName.trim()) {
      wx.showToast({
        title: '请输入房间名称',
        icon: 'none'
      })
      return
    }

    if (this.data.creating) return

    // 生成6位邀请码并存入 data，供 onShareAppMessage 使用
    const inviteCode = this.generateInviteCode()
    this.setData({ creating: true, inviteCode })

    // 调用云函数创建房间
    wx.cloud.callFunction({
      name: 'createRoom',
      data: {
        roomName: this.data.roomName.trim(),
        maxPlayers: this.data.maxPlayers,
        inviteCode: inviteCode,
        creator: app.globalData.userInfo
      }
    }).then(res => {
      this.setData({ creating: false })
      
      if (res.result && res.result.success) {
        const roomId = res.result._id
        
        // 保存房间信息到全局
        app.globalData.currentRoom = {
          _id: roomId,
          inviteCode: inviteCode,
          roomName: this.data.roomName.trim()
        }

        wx.showModal({
          title: '房间创建成功',
          content: `房间号：${inviteCode}\n快分享给好友一起游戏吧！`,
          showCancel: false,
          confirmText: '进入房间',
          success: () => {
            wx.redirectTo({
              url: `/pages/room/room?roomId=${roomId}&inviteCode=${inviteCode}`
            })
          }
        })
      } else {
        wx.showToast({
          title: (res.result && res.result.error) || '创建失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      this.setData({ creating: false })
      console.error('创建房间失败:', err)
      wx.showToast({
        title: '创建失败，请重试',
        icon: 'none'
      })
    })
  },

  // 生成6位邀请码
  generateInviteCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  },

  // 通过邀请码加入房间
  joinByInviteCode(inviteCode) {
    wx.cloud.callFunction({
      name: 'joinRoom',
      data: {
        inviteCode: inviteCode,
        user: app.globalData.userInfo
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const room = res.result.room
        app.globalData.currentRoom = {
          _id: room._id,
          inviteCode: room.inviteCode,
          roomName: room.roomName
        }
        
        wx.redirectTo({
          url: `/pages/room/room?roomId=${room._id}&inviteCode=${room.inviteCode}`
        })
      } else {
        wx.showToast({
          title: (res.result && res.result.error) || '加入失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('加入房间失败:', err)
      wx.showToast({
        title: '加入失败，请重试',
        icon: 'none'
      })
    })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.roomName || '纸牌游戏'} - 快来加入我的房间！`,
      path: `/pages/join/join?inviteCode=${this.data.inviteCode}`
    }
  }
})