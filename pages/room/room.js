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
    rankList: [],         // 排名
    currentUserId: '',
    isCreator: false,
    showCustomBanner: true,
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
  isLeaving: false,

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

    // 获取当前用户ID（必须与云函数存储的 wxContext.OPENID 一致）
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo.openId) {
      this.setData({ currentUserId: userInfo.openId })
    } else {
      // openId 未获取到，重新从登录云函数取
      wx.cloud.callFunction({ name: 'login' }).then(loginRes => {
        const openId = loginRes.result.openid
        if (userInfo) {
          userInfo.openId = openId
          app.globalData.userInfo = userInfo
        }
        this.setData({ currentUserId: openId })
        // 异步获取到 openId 后，立即补算 isCreator（修复首次加载房主按钮不显示的问题）
        if (this.data.room) {
          this.setData({ isCreator: this.data.room.creatorId === openId })
        }
      })
    }
    
    this.watchRoom(roomId)
  },

  onUnload: function () {
    if (this.roomWatcher) {
      this.roomWatcher.close()
      this.roomWatcher = null
    }
    // 不自动退出房间，玩家可通过"返回房间"重新进入
  },

  // 监听房间数据
  watchRoom(roomId) {
    // 先关闭之前的监听器（如果存在）
    if (this.roomWatcher) {
      this.roomWatcher.close()
      this.roomWatcher = null
    }

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

          // 检测当前用户是否还在房间中（被踢时自动跳走，主动离开时跳过）
          const currentUserId = this.data.currentUserId
          if (currentUserId && !this.data.isLoading && !this.isLeaving) {
            const stillInRoom = players.some(p => p.userId === currentUserId)
            if (!stillInRoom) {
              app.globalData.currentRoom = null
              wx.showToast({ title: '您已被移出房间', icon: 'none' })
              setTimeout(() => {
                wx.navigateBack({ delta: 2, fail: () => wx.navigateTo({ url: '/pages/index/index' }) })
              }, 1500)
              return
            }
          }

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

          // 计算排名
          const rankEmojis = ['🥇', '🥈', '🥉']
          const indexed = totals.map((t, i) => ({ total: t, idx: i }))
          indexed.sort((a, b) => b.total - a.total)
          const rankList = new Array(totals.length).fill('')
          indexed.forEach((item, rank) => {
            rankList[item.idx] = rank < 3 ? rankEmojis[rank] : (rank + 1) + '位'
          })

          this.setData({
            room: room,
            roomName: room.roomName || '记分房间',
            players: players,
            rounds: rounds,
            scores: scores,
            totals: totals,
            scoreValues: scoreValues,
            scoreClassList: scoreClassList,
            totalDisplayList: totalDisplayList,
            totalClassList: totalClassList,
            rankList: rankList,
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

  // 显示编辑弹窗 - 修改玩家名称（只能改自己）
  showEditPlayerName(e) {
    // data-own 由 WXML 模板在渲染时已算好，双重保险
    if (!e.currentTarget.dataset.own) return

    const playerIndex = e.currentTarget.dataset.index
    const player = this.data.players[playerIndex]

    // 再次用 userId 校验，防止异常情况
    if (!this.data.currentUserId || player.userId !== this.data.currentUserId) return

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

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 切换分数正负号（弹窗内）
  toggleScoreSign(e) {
    const sign = e.currentTarget.dataset.sign
    this.setData({
      scoreSign: sign
    })
  },

  // 输入编辑值
  onEditInput(e) {
    let value = e.detail.value
    // 分数只能是数字
    if (this.data.editType === 'score') {
      value = value.replace(/[^0-9]/g, '')
    } else {
      value = value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-]/g, '').substring(0, 10)
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
      if (isNaN(scoreValue)) {
        wx.showToast({
          title: '请输入有效数字',
          icon: 'none'
        })
        return
      }
      if (scoreValue > 99999) {
        wx.showToast({
          title: '分数最大为99999',
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
            title: (res.result && res.result.error) || '更新失败',
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

  // 清空某一局的分数
  clearRound(e) {
    if (!this.data.isCreator) {
      wx.showToast({
        title: '只有房主可以清空',
        icon: 'none'
      })
      return
    }

    const roundIndex = e.currentTarget.dataset.roundindex

    wx.showModal({
      title: '确认清空',
      content: `将清空第${Number(roundIndex) + 1}局所有玩家的分数`,
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'clearRound',
            data: {
              roomId: this.data.roomId,
              roundIndex: roundIndex
            }
          }).then(res => {
            if (!res.result || !res.result.success) {
              wx.showToast({
                title: (res.result && res.result.error) || '清空失败',
                icon: 'none'
              })
            } else {
              wx.showToast({
                title: '已清空',
                icon: 'success'
              })
            }
          }).catch(err => {
            console.error('清空局数失败:', err)
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  // 减少一局（删除最后一局）
  removeRound() {
    if (!this.data.isCreator) {
      wx.showToast({
        title: '只有房主可以减少局数',
        icon: 'none'
      })
      return
    }

    if (this.data.scores.length === 0) {
      wx.showToast({
        title: '没有可以删除的局数',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: '将删除最后一局的分数记录',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'removeRound',
            data: {
              roomId: this.data.roomId
            }
          }).then(res => {
            if (!res.result || !res.result.success) {
              wx.showToast({
                title: (res.result && res.result.error) || '删除失败',
                icon: 'none'
              })
            } else {
              wx.showToast({
                title: '已删除',
                icon: 'success'
              })
            }
          }).catch(err => {
            console.error('删除局数失败:', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  // 离开房间
  leaveRoom() {
    wx.showModal({
      title: '确认离开',
      content: '离开房间后将从玩家列表中移除，房间将返回主页',
      success: (res) => {
        if (res.confirm) {
          this.isLeaving = true
          // 调用云函数从房间移除当前用户
          wx.cloud.callFunction({
            name: 'leaveRoom',
            data: {
              roomId: this.data.roomId
            }
          }).then(res => {
            // 无论成功失败都返回主页
            wx.navigateBack({
              delta: 2,
              fail: () => {
                wx.redirectTo({
                  url: '/pages/index/index'
                })
              }
            })
          }).catch(err => {
            console.error('离开房间失败:', err)
            // 即使云函数调用失败也返回主页
            wx.navigateBack({
              delta: 2,
              fail: () => {
                wx.redirectTo({
                  url: '/pages/index/index'
                })
              }
            })
          })
        }
      }
    })
  },

  onShareAppMessage() {
    const roomName = this.data.roomName || '开心记分'
    const inviteCode = this.data.inviteCode
    
    return {
      title: `${roomName} - 快来加入我的房间！`,
      path: `/pages/join/join?inviteCode=${inviteCode}`
    }
  },

  onShareTimeline() {
    const roomName = this.data.roomName || '开心记分'
    return {
      title: `${roomName} - 多人计分器`
    }
  },

  onAdLoad() {
    this.setData({ showCustomBanner: false })
  },

  onAdError() {
    this.setData({ showCustomBanner: true })
  }
})