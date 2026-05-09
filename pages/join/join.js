const app = getApp()

Page({
  data: {
    inviteCode: '',
    joining: false
  },

  onLoad: function () {
    // 检查是否从分享链接进入，带有邀请码参数
    const options = this.options
    if (options && options.inviteCode) {
      this.setData({
        inviteCode: options.inviteCode.toUpperCase()
      })
      // 自动尝试加入
      setTimeout(() => {
        this.joinRoom()
      }, 500)
    }
  },

  // 输入邀请码
  onInviteCodeInput(e) {
    // 转换为大写并限制为6位
    let value = e.detail.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length > 6) {
      value = value.substring(0, 6)
    }
    this.setData({
      inviteCode: value
    })
  },

  // 加入房间
  joinRoom() {
    const code = this.data.inviteCode.trim()
    
    if (!code) {
      wx.showToast({
        title: '请输入邀请码',
        icon: 'none'
      })
      return
    }

    if (code.length !== 6) {
      wx.showToast({
        title: '邀请码为6位字符',
        icon: 'none'
      })
      return
    }

    if (this.data.joining) return

    this.setData({ joining: true })

    // 调用云函数加入房间
    wx.cloud.callFunction({
      name: 'joinRoom',
      data: {
        inviteCode: code,
        user: app.globalData.userInfo
      }
    }).then(res => {
      this.setData({ joining: false })
      
      if (res.result && res.result.success) {
        const room = res.result.room
        
        // 保存房间信息到全局
        app.globalData.currentRoom = {
          _id: room._id,
          inviteCode: room.inviteCode,
          roomName: room.roomName
        }

        // 如果用户已经在房间中，提示并返回
        if (res.result.alreadyInRoom) {
          wx.showModal({
            title: '您已在房间中',
            content: `房间：${room.roomName}\n房间号：${room.inviteCode}\n是否返回房间？`,
            confirmText: '返回房间',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.redirectTo({
                  url: `/pages/room/room?roomId=${room._id}&inviteCode=${room.inviteCode}`
                })
              }
            }
          })
        } else {
          wx.redirectTo({
            url: `/pages/room/room?roomId=${room._id}&inviteCode=${room.inviteCode}`
          })
        }
      } else {
        wx.showToast({
          title: (res.result && res.result.error) || '加入失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      this.setData({ joining: false })
      console.error('加入房间失败:', err)
      wx.showToast({
        title: '加入失败，请检查邀请码',
        icon: 'none'
      })
    })
  },

  // 粘贴邀请码
  async pasteInviteCode() {
    try {
      const { tempFilePath } = await wx.getClipboardFile({
        sourceType: ['album']
      })
      // 这里可以添加OCR识别功能，暂时只提示手动输入
      wx.showToast({
        title: '请手动输入邀请码',
        icon: 'none'
      })
    } catch (err) {
      console.error(err)
    }
  },

  // 跳转到创建房间页面
  goToCreate() {
    wx.navigateTo({
      url: '/pages/create/create'
    })
  },

  onShareAppMessage() {
    return {
      title: '纸牌游戏计分器 - 快来加入我的房间！',
      path: '/pages/index/index'
    }
  }
})
