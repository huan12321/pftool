const app = getApp();

Page({
  data: {
    currentSeason: null,
    currentScore: 0,
    inputScore: '',
    currentTime: '',
    operationButtons: [
      { label: '+10', value: 10 },
      { label: '+13', value: 13 },
      { label: '+16', value: 16 },
      { label: '+19', value: 19 },
      { label: '+22', value: 22 },
      { label: '-10', value: -10 }
    ]
  },

  onLoad() {
    this.loadCurrentSeason();
    this.setCurrentTime();
  },

  onShow() {
    this.loadCurrentSeason();
  },

  loadCurrentSeason() {
    const seasonId = wx.getStorageSync('currentSeasonId');
    const seasons = wx.getStorageSync('seasons') || [];
    const currentSeason = seasons.find(s => s.id === seasonId) || seasons[0] || null;
    
    if (currentSeason) {
      wx.setStorageSync('currentSeasonId', currentSeason.id);
      const records = wx.getStorageSync('records') || {};
      const seasonRecords = records[currentSeason.id] || [];
      // 获取当前分数（最后一次记录或初始分数）
      const currentScore = seasonRecords.length > 0 
        ? seasonRecords[seasonRecords.length - 1].score 
        : currentSeason.initialScore;
      
      this.setData({
        currentSeason,
        currentScore
      });
    } else {
      this.setData({
        currentSeason: null,
        currentScore: 0
      });
      wx.showToast({
        title: '请先创建赛季',
        icon: 'none',
        duration: 2000
      });
    }
  },

  setCurrentTime() {
    const now = new Date();
    // 使用东八区时间
    now.setHours(now.getHours() + 8);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${year}-${month}-${day} ${hours}:${minutes}`; // 格式: YYYY-MM-DD HH:MM
    this.setData({
      currentTime: timeStr
    });
  },

  showTimeSelector() {
    // 先选择日期
    wx.showDatePickerModal({
      startDate: '2020-01-01',
      endDate: '2030-12-31',
      currentDate: this.data.currentTime.split(' ')[0],
      success: (dateRes) => {
        // 再选择时间
        wx.showTimePickerModal({
          startHour: 0,
          endHour: 23,
          currentTime: this.data.currentTime.split(' ')[1],
          success: (timeRes) => {
            const selectedTime = `${dateRes.date} ${timeRes.time}`;
            this.setData({
              currentTime: selectedTime
            });
          }
        });
      }
    });
  },

  handleOperation(e) {
    const value = e.currentTarget.dataset.value;
    let newScore = this.data.currentScore + value;
    
    // 确保分数在0-10000之间
    if (newScore < 0) newScore = 0;
    if (newScore > 10000) newScore = 10000;
    
    this.setData({
      currentScore: newScore,
      inputScore: ''
    });
  },

  handleInputScore(e) {
    const value = e.detail.value;
    this.setData({
      inputScore: value
    });
  },

  confirmInputScore() {
    const score = parseInt(this.data.inputScore);
    if (!isNaN(score) && score >= 0 && score <= 10000) {
      this.setData({
        currentScore: score,
        inputScore: ''
      });
    } else {
      wx.showToast({
        title: '请输入0-10000之间的数字',
        icon: 'none'
      });
    }
  },

  saveRecord() {
    if (!this.data.currentSeason) {
      wx.showToast({
        title: '请先选择赛季',
        icon: 'none'
      });
      return;
    }

    const records = wx.getStorageSync('records') || {};
    const seasonId = this.data.currentSeason.id;
    
    if (!records[seasonId]) {
      records[seasonId] = [];
    }
    
    // 检查是否已存在相同时间的记录
    const existingRecordIndex = records[seasonId].findIndex(record => record.time === this.data.currentTime);
    
    if (existingRecordIndex !== -1) {
      // 更新现有记录
      records[seasonId][existingRecordIndex].score = this.data.currentScore;
      wx.showToast({
        title: '记录已更新',
        icon: 'success'
      });
    } else {
      // 创建新记录
      const newRecord = {
        id: Date.now().toString(),
        score: this.data.currentScore,
        time: this.data.currentTime,
        timestamp: new Date(this.data.currentTime).getTime()
      };
      
      records[seasonId].push(newRecord);
      wx.showToast({
        title: '记录保存成功',
        icon: 'success'
      });
    }
    
    wx.setStorageSync('records', records);
    
    // 更新当前分数
    this.setData({
      currentScore: this.data.currentScore
    });
    
    // 重置时间为当前时间
    this.setCurrentTime();
  },

  goToSeasons() {
    wx.navigateTo({
      url: '/pages/seasons/seasons'
    });
  }
})
