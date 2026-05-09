App({
  onLaunch: function () {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true
      })
    }
    
    this.globalData = {}
  },

  globalData: {
    userInfo: null,
    currentRoom: null
  }
})