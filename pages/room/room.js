const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    roomId: '',
    inviteCode: '',
    room: null,
    players: [],
    rounds: 0,
    scores: [],      // 二维数组 [roundIndex][playerIndex]
    totals: [],      // 每个玩家的总分
    currentUserId: '',
    isCreator: false,
    showEditModal: false,
    editType: '',    // 'playerName' | 'score'
    editRoundIndex: -1,
    editPlayerIndex: -1,
    editValue: '',
    showAddRoundConfirm: false
  },

  // 实时监听房间数据
  roomWatcher: null,

  onLoad: function (options) {
    const roomId = options.roomId
    const inviteCode = options.inviteCode

    if (!roomId || !inviteCode) {
      wx.showToast({
        title: '房间信息不完整',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({
      roomId,
      inviteCode
    })

    // 获取当前用户ID
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        currentUserId: userInfo.openId || userInfo.nickName
      })
    }

    // 监听房间数据变化
    this.watchRoom(roomId)
  },

  onUnload: function () {
    if (this.roomWatcher) {
      this.roomWatcher.close()
    }
  },

  // 监听房间数据
  watchRoom(roomId) {
    const db = wx.cloud.database()
    
    this.roomWatcher = db.collection('rooms').doc(roomId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) {
          const room = snapshot.docs[0]
          const players = room.players || []
          const scores = room.scores || []
          const rounds = scores.length
          
          // 计算每个玩家的总分
          const totals = this.calculateTotals(scores, players.length)
          
          this.setData({
            room: room,
            players: players,
            rounds: rounds,
            scores: scores,
            totals: totals,
            isCreator: room.creatorId === this.data.currentUserId
          })
        } else {
          wx.showToast({
            title: '房间不存在',
            icon: 'none'
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      },
      onError: (err) => {
        console.error('监听房间失败:', err)
      }
    })
  },

  // 计算总分
  calculateTotals(scores, playerCount) {
    const totals = new Array(playerCount).fill(0)
    scores.forEach(round => {
      round.forEach((score, playerIndex) => {
        totals[playerIndex] += score || 0
      })
    })
    return totals
  },

  // 添加玩家
  addPlayer() {
    if (!this.data.room) return

    const playerCount = this.data.players.length
    if (playerCount >= (this.data.room.maxPlayers || 8)) {
      wx.showToast({
        title: '玩家已满',
        icon: 'none'
      })
      return
    }

    const newPlayerName = `玩家${playerCount + 1}`
    
    wx.cloud.callFunction({
      name: 'addPlayer',
      data: {
        roomId: this.data.roomId,
        playerName: newPlayerName
      }
    }).then(res => {
      if (!res.result || !res.result.success) {
        wx.showToast({
          title: res.result?.error || '添加失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('添加玩家失败:', err)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    })
  },

  // 删除玩家
  deletePlayer(e) {
    const playerIndex = e.currentTarget.dataset.index
    
    wx.showModal({
      title: '确认删除',
      content: '删除玩家将清空该玩家的所有分数记录',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'deletePlayer',
            data: {
              roomId: this.data.roomId,
              playerIndex: playerIndex
            }
          }).then(res => {
            if (!res.result || !res.result.success) {
              wx.showToast({
                title: res.result?.error || '删除失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            console.error('删除玩家失败:', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  // 添加新局
  addRound() {
    if (!this.data.room) return

    const playerCount = this.data.players.length
    if (playerCount === 0) {
      wx.showToast({
        title: '请先添加玩家',
        icon: 'none'
      })
      return
    }

    // 新的一局，所有玩家默认0分
    const newRound = new Array(playerCount).fill(0)

    wx.cloud.callFunction({
      name: 'addRound',
      data: {
        roomId: this.data.roomId,
        roundScores: newRound
      }
    }).then(res => {
      if (!res.result || !res.result.success) {
        wx.showToast({
          title: res.result?.error || '添加失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('添加局数失败:', err)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    })
  },

  // 显示编辑弹窗 - 修改玩家名称
  showEditPlayerName(e) {
    const playerIndex = e.currentTarget.dataset.index
    const player = this.data.players[playerIndex]
    
    this.setData({
      showEditModal: true,
      editType: 'playerName',
      editPlayerIndex: playerIndex,
      editRoundIndex: -1,
      editValue: player.name
    })
  },

  // 显示编辑弹窗 - 修改分数
  showEditScore(e) {
    const roundIndex = e.currentTarget.dataset.roundindex
    const playerIndex = e.currentTarget.dataset.playerindex
    
    const currentScore = this.data.scores[roundIndex] ? 
      (this.data.scores[roundIndex][playerIndex] || 0) : 0
    
    this.setData({
      showEditModal: true,
      editType: 'score',
      editRoundIndex: roundIndex,
      editPlayerIndex: playerIndex,
      editValue: currentScore.toString()
    })
  },

  // 隐藏编辑弹窗
  hideEditModal() {
    this.setData({
      showEditModal: false,
      editType: '',
      editRoundIndex: -1,
      editPlayerIndex: -1,
      editValue: ''
    })
  },

  // 输入编辑值
  onEditInput(e) {
    let value = e.detail.value
    // 分数可以是负数
    if (this.data.editType === 'score') {
      value = value.replace(/[^\-0-9]/g, '')
    } else {
      value = value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').substring(0, 10)
    }
    this.setData({
      editValue: value
    })
  },

  // 提交编辑
  submitEdit() {
    const value = this.data.editValue.trim()
    
    if (!value && this.data.editType === 'score') {
      wx.showToast({
        title: '请输入分数',
        icon: 'none'
      })
      return
    }

    if (!value && this.data.editType === 'playerName') {
      wx.showToast({
        title: '请输入玩家名称',
        icon: 'none'
      })
      return
    }

    if (this.data.editType === 'playerName') {
      // 修改玩家名称
      wx.cloud.callFunction({
        name: 'updatePlayerName',
        data: {
          roomId: this.data.roomId,
          playerIndex: this.data.editPlayerIndex,
          newName: value
        }
      }).then(res => {
        this.hideEditModal()
        if (!res.result || !res.result.success) {
          wx.showToast({
            title: res.result?.error || '更新失败',
            icon: 'none'
          })
        }
      }).catch(err => {
        console.error('更新玩家名称失败:', err)
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        })
      })
    } else if (this.data.editType === 'score') {
      // 修改分数
      const scoreValue = parseInt(value)
      if (isNaN(scoreValue)) {
        wx.showToast({
          title: '请输入有效数字',
          icon: 'none'
        })
        return
      }

      wx.cloud.callFunction({
        name: 'updateScore',
        data: {
          roomId: this.data.roomId,
          roundIndex: this.data.editRoundIndex,
          playerIndex: this.data.editPlayerIndex,
          score: scoreValue
        }
      }).then(res => {
        this.hideEditModal()
        if (!res.result || !res.result.success) {
          wx.showToast({
            title: res.result?.error || '更新失败',
            icon: 'none'
          })
        }
      }).catch(err => {
        console.error('更新分数失败:', err)
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        })
      })
    }
  },

  // 重置所有分数
  resetAllScores() {
    if (!this.data.isCreator) {
      wx.showToast({
        title: '只有房主可以重置',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认重置',
      content: '将清空所有分数记录，但保留玩家信息',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'resetScores',
            data: {
              roomId: this.data.roomId
            }
          }).then(res => {
            if (!res.result || !res.result.success) {
              wx.showToast({
                title: res.result?.error || '重置失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            console.error('重置失败:', err)
            wx.showToast({
              title: '重置失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  // 复制房间号
  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({
          title: '房间号已复制',
          icon: 'success'
        })
      }
    })
  },

  // 分享房间
  shareRoom() {
    const inviteCode = this.data.inviteCode
    const roomName = this.data.room?.roomName || '游戏计分'

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 离开房间
  leaveRoom() {
    wx.showModal({
      title: '确认离开',
      content: '离开房间后将返回主页',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack({
            delta: 2,
            fail: () => {
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      }
    })
  },

  onShareAppMessage() {
    const roomName = this.data.room?.roomName || '游戏计分'
    const inviteCode = this.data.inviteCode
    
    return {
      title: `${roomName} - 快来加入我的房间！`,
      path: `/pages/create/create?inviteCode=${inviteCode}`
    }
  },

  onShareTimeline() {
    const roomName = this.data.room?.roomName || '游戏计分'
    return {
      title: `${roomName} - 多人计分器`
    }
  }
})