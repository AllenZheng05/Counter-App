const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    showReturnRoom: false,
    returnRoomInfo: null,
    checkingRoom: false,
    // 初始设置
    setupAvatarUrl: '',
    setupNickName: '',
    // 编辑用户信息相关
    showEditProfileModal: false,
    editNickName: '',
    editAvatarUrl: ''
  },

  onShow: function () {
    // 每次页面显示时检查是否需要显示返回房间按钮
    this.checkCanReturnRoom()
  },

  onLoad: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    }
  },

  // 显示编辑用户信息弹窗
  showEditProfile() {
    this.setData({
      showEditProfileModal: true,
      editNickName: this.data.userInfo.nickName || '',
      editAvatarUrl: this.data.userInfo.avatarUrl || ''
    })
  },

  // 隐藏编辑用户信息弹窗
  hideEditProfile() {
    this.setData({
      showEditProfileModal: false,
      editNickName: '',
      editAvatarUrl: ''
    })
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({
      editNickName: e.detail.value
    })
  },

  // 选择头像（初始设置）
  onChooseAvatar(e) {
    this.setData({ setupAvatarUrl: e.detail.avatarUrl })
  },

  // 输入昵称（初始设置）
  onSetupNickNameInput(e) {
    this.setData({ setupNickName: e.detail.value })
  },

  // 确认初始设置
  confirmSetup() {
    const nickName = this.data.setupNickName.trim()
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!this.data.setupAvatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }

    wx.showLoading({ title: '设置中...' })
    const fileName = `avatar/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
    wx.cloud.uploadFile({
      cloudPath: fileName,
      filePath: this.data.setupAvatarUrl,
      success: (uploadRes) => {
        wx.cloud.callFunction({ name: 'login' }).then(loginRes => {
          const userInfo = {
            nickName,
            avatarUrl: uploadRes.fileID,
            openId: loginRes.result.openid
          }
          this.setData({ userInfo, hasUserInfo: true, setupAvatarUrl: '', setupNickName: '' })
          app.globalData.userInfo = userInfo
          wx.hideLoading()
        }).catch(() => {
          const userInfo = { nickName, avatarUrl: uploadRes.fileID }
          this.setData({ userInfo, hasUserInfo: true, setupAvatarUrl: '', setupNickName: '' })
          app.globalData.userInfo = userInfo
          wx.hideLoading()
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '设置失败，请重试', icon: 'none' })
      }
    })
  },

  // 选择头像（编辑弹窗）
  onEditChooseAvatar(e) {
    this.setData({ editAvatarUrl: e.detail.avatarUrl })
  },

  // 保存用户信息（编辑弹窗）
  saveProfile() {
    const nickName = this.data.editNickName.trim()
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    const doSave = (avatarUrl) => {
      const newUserInfo = {
        nickName,
        avatarUrl,
        openId: this.data.userInfo.openId
      }
      this.setData({ userInfo: newUserInfo, showEditProfileModal: false, editNickName: '', editAvatarUrl: '' })
      app.globalData.userInfo = newUserInfo
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
    }

    // 头像未变化（仍是原来的云存储地址）则直接保存
    if (this.data.editAvatarUrl === this.data.userInfo.avatarUrl) {
      doSave(this.data.editAvatarUrl)
      return
    }

    // 头像已更换，上传新头像
    const fileName = `avatar/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
    wx.cloud.uploadFile({
      cloudPath: fileName,
      filePath: this.data.editAvatarUrl,
      success: (uploadRes) => doSave(uploadRes.fileID),
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '上传头像失败', icon: 'none' })
      }
    })
  },

  // 检查是否可以返回房间
  checkCanReturnRoom: function () {
    // 如果没有用户信息或没有当前房间信息，不显示
    if (!app.globalData.userInfo || !app.globalData.currentRoom) {
      this.setData({
        showReturnRoom: false,
        returnRoomInfo: null
      })
      return
    }

    // 如果正在检查，不重复检查
    if (this.data.checkingRoom) {
      return
    }

    this.setData({ checkingRoom: true })

    const roomId = app.globalData.currentRoom._id
    const userId = app.globalData.userInfo.openId

    // 查询房间，检查用户是否还在玩家列表中
    db.collection('rooms').doc(roomId).get().then(res => {
      this.setData({ checkingRoom: false })
      
      if (res.data) {
        const room = res.data
        const players = room.players || []
        
        // 检查当前用户是否还在房间中
        const isInRoom = players.some(p => p.userId === userId)
        
        if (isInRoom) {
          this.setData({
            showReturnRoom: true,
            returnRoomInfo: {
              _id: room._id,
              inviteCode: room.inviteCode,
              roomName: room.roomName
            }
          })
        } else {
          // 用户不在房间中了，清除本地记录
          app.globalData.currentRoom = null
          this.setData({
            showReturnRoom: false,
            returnRoomInfo: null
          })
        }
      } else {
        // 房间不存在，清除本地记录
        app.globalData.currentRoom = null
        this.setData({
          showReturnRoom: false,
          returnRoomInfo: null
        })
      }
    }).catch(err => {
      console.error('检查房间状态失败:', err)
      this.setData({ checkingRoom: false })
      // 出错时不显示返回按钮
      this.setData({
        showReturnRoom: false,
        returnRoomInfo: null
      })
    })
  },

  // 返回房间
  returnToRoom: function () {
    if (!this.data.returnRoomInfo) {
      return
    }

    const roomInfo = this.data.returnRoomInfo
    
    wx.redirectTo({
      url: `/pages/room/room?roomId=${roomInfo._id}&inviteCode=${roomInfo.inviteCode}`
    })
  },

  // 创建房间
  goToCreate() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先授权用户信息',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: '/pages/create/create'
    })
  },

  // 加入房间
  goToJoin() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先授权用户信息',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: '/pages/join/join'
    })
  },

  stopPropagation() {},

  onShareAppMessage() {
    return {
      title: '开心记分器 - 快来一起记分吧！',
      path: '/pages/index/index'
    }
  }
})