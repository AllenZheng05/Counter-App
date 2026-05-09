const app = getApp()

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: wx.getUserProfile ? true : false
  },

  onLoad: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    }
  },

  // 获取用户信息
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于记录您的游戏分数',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
        app.globalData.userInfo = res.userInfo
      },
      fail: (err) => {
        console.log('获取用户信息失败', err)
        wx.showToast({
          title: '请先授权用户信息',
          icon: 'none'
        })
      }
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

  onShareAppMessage() {
    return {
      title: '纸牌游戏计分器 - 快来一起记分吧！',
      path: '/pages/index/index'
    }
  }
})