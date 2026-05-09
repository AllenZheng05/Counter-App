App({
  onLaunch: function () {
    if (wx.cloud) {
      wx.cloud.init({
        env: "cloudbase-d8ga1gxtlf24afb9b",
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