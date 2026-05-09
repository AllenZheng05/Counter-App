const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    roomId: '',
    inviteCode: '',
    room: null,
    roomName: '加载中...',
    players: [],
    rounds: 0,
    scores: [],      // 二维数组 [roundIndex][playerIndex]
    totals: [],      // 每个玩家的总分
    scoreValues: {},  // 分数显示值
    scoreClassList: {}, // 分数样式
    totalDisplayList: [], // 总分显示
    totalClassList: [],   // 总分样式
    currentUserId: '',
    isCreator: false,
    showEditModal: false,
    editType: '',    // 'playerName' | 'score'
    editRoundIndex: -1,
    editPlayerIndex: -1,
    editValue: '',
    scoreSign: '+',   // '+' or '-'
    isLoading: true   // 数据加载状态
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
        // 首次加载完成后，关闭加载状态
        if (this.data.isLoading) {
          this.setData({ isLoading: false })
        }
        if (snapshot.docs.length > 0) {
          const room = snapshot.docs[0]
          const players = room.players || []
          const scores = room.scores || []
          const rounds = scores.length
          
          // 计算每个玩家的总分
          const totals = this.calculateTotals(scores, players.length)
          
          // 计算显示值和样式
          const scoreValues = {}
          const scoreClassList = {}
          scores.forEach((round, rIndex) => {
            round.forEach((score, pIndex) => {
              const key = rIndex + '-' + pIndex
              scoreValues[key] = score || 0
              if (score > 0) {
                scoreClassList[key] = 'positive'
              } else if (score < 0) {
                scoreClassList[key] = 'negative'
              } else {
                scoreClassList[key] = ''
              }
            })
          })
          
          const totalDisplayList = []
          const totalClassList = []
          totals.forEach(total => {
            if (total > 0) {
              totalDisplayList.push('+' + total)
              totalClassList.push('positive')
            } else if (total < 0) {
              totalDisplayList.push('' + total)
              totalClassList.push('negative')
            } else {
              totalDisplayList.push('0')
              totalClassList.push('')
            }
          })
          
          this.setData({
            room: room,
            roomName: room.roomName || '游戏房间',
            players: players,
            rounds: rounds,
            scores: scores,
            totals: totals,
            scoreValues: scoreValues,
            scoreClassList: scoreClassList,
            totalDisplayList: totalDisplayList,
            totalClassList: totalClassList,
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
          title: (res.result && res.result.error) || '添加失败',
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
                title: (res.result && res.result.error) || '删除失败',
                icon: 'none'
              })
            } else {
              // 如果房间被自动解散（没有玩家了），则返回上一页
              if (res.result.roomDeleted) {
                wx.showToast({
                  title: '房间已自动解散',
                  icon: 'success'
                })
                setTimeout(() => {
                  wx.navigateBack({
                    delta: 1,
                    fail: () => {
                      wx.switchTab({
                        url: '/pages/index/index'
                      })
                    }
                  })
                }, 1500)
              }
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
          title: (res.result && res.result.error) || '添加失败',
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
    
    // 判断当前分数是正数还是负数
    const scoreSign = currentScore >= 0 ? '+' : '-'
    const absScore = Math.abs(currentScore)
    
    this.setData({
      showEditModal: true,
      editType: 'score',
      editRoundIndex: roundIndex,
      editPlayerIndex: playerIndex,
      editValue: absScore.toString(),
      scoreSign: scoreSign
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

  // 切换分数正负号（弹窗内）
  toggleScoreSign(e) {
    const sign = e.currentTarget.dataset.sign
    this.setData({
      scoreSign: sign
    })
  },

  // 在格子上直接切换正负号
  toggleScoreSignOnCell(e) {
    const roundIndex = e.currentTarget.dataset.roundindex
    const playerIndex = e.currentTarget.dataset.playerindex
    
    const currentScore = this.data.scores[roundIndex] ? 
      (this.data.scores[roundIndex][playerIndex] || 0) : 0
    
    // 如果当前分数是0，不做任何操作
    if (currentScore === 0) {
      wx.showToast({
        title: '分数为0，无需切换',
        icon: 'none'
      })
      return
    }
    
    // 取反分数
    const newScore = -currentScore
    
    wx.cloud.callFunction({
      name: 'updateScore',
      data: {
        roomId: this.data.roomId,
        roundIndex: roundIndex,
        playerIndex: playerIndex,
        score: newScore
      }
    }).then(res => {
      if (!res.result || !res.result.success) {
        wx.showToast({
          title: res.result?.error || '更新失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('切换正负号失败:', err)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    })
  },

  // 输入编辑值
  onEditInput(e) {
    let value = e.detail.value
    // 分数只能是数字
    if (this.data.editType === 'score') {
      value = value.replace(/[^0-9]/g, '')
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
            title: (res.result && res.result.error) || '更新失败',
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
      if (isNaN(scoreValue) || scoreValue === 0) {
        wx.showToast({
          title: '请输入有效数字',
          icon: 'none'
        })
        return
      }

      // 根据符号决定正负
      const finalScore = this.data.scoreSign === '-' ? -scoreValue : scoreValue

      wx.cloud.callFunction({
        name: 'updateScore',
        data: {
          roomId: this.data.roomId,
          roundIndex: this.data.editRoundIndex,
          playerIndex: this.data.editPlayerIndex,
          score: finalScore
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
                title: (res.result && res.result.error) || '重置失败',
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
    const roomName = this.data.roomName || '游戏计分'

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
    const roomName = this.data.roomName || '游戏计分'
    const inviteCode = this.data.inviteCode
    
    return {
      title: `${roomName} - 快来加入我的房间！`,
      path: `/pages/create/create?inviteCode=${inviteCode}`
    }
  },

  onShareTimeline() {
    const roomName = this.data.roomName || '游戏计分'
    return {
      title: `${roomName} - 多人计分器`
    }
  }
})