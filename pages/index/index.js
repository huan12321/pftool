const app = getApp();

Page({
  data: {
    currentSeason: null,
    currentScore: 0,
    inputScore: '',
    currentTime: '',
    timeVisible: false,
    operationButtons: [
      { label: '+10', value: 10 },
      { label: '+13', value: 13 },
      { label: '+16', value: 16 },
      { label: '+19', value: 19 },
      { label: '+22', value: 22 },
      { label: '-10', value: -10 }
    ],
    lastScore: 0, // 上一次保存的分数
    changeValue: 0, // 当前变化量
    displayScore: 0 // 显示的分数（lastScore + changeValue）
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
      let currentScore = seasonRecords.length > 0 
        ? seasonRecords[seasonRecords.length - 1].score 
        : currentSeason.initialScore;
      
      this.setData({
        currentSeason,
        lastScore: currentScore,
        currentScore: currentScore,
        displayScore: currentScore,
        changeValue: 0
      });
    } else {
      this.setData({
        currentSeason: null,
        lastScore: 0,
        currentScore: 0,
        displayScore: 0,
        changeValue: 0
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
  
  formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace('T', ' ');
  },
  
  handleTimeInput(e) {
    const value = e.detail.value;
    this.setData({
      currentTime: value
    });
    
    this.validateTimeFormat(value);
  },
  
  validateTimeFormat(timeStr) {
    const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    
    if (!timeRegex.test(timeStr)) {
      return false;
    }
    
    const parts = timeStr.split(' ');
    const dateParts = parts[0].split('-');
    const timeParts = parts[1].split(':');
    
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    
    if (year < 2020 || year > 2030) {
      return false;
    }
    
    if (month < 1 || month > 12) {
      return false;
    }
    
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return false;
    }
    
    if (hours < 0 || hours > 23) {
      return false;
    }
    
    if (minutes < 0 || minutes > 59) {
      return false;
    }
    
    return true;
  },
  
  showTimeSelector() {
    const that = this;
    
    // 使用微信官方的时间选择器
    wx.showPicker({
      type: 'time',
      value: this.getCurrentTimeValue(),
      success: (timeRes) => {
        const hours = String(timeRes.value.split(':')[0]).padStart(2, '0');
        const minutes = String(timeRes.value.split(':')[1]).padStart(2, '0');
        
        // 获取当前日期
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        const timeStr = `${year}-${month}-${day} ${hours}:${minutes}`;
        that.setData({
          currentTime: timeStr
        });
      },
      fail: () => {
        // 用户取消选择
      }
    });
  },

  // 辅助方法：获取当前时间值
getCurrentTimeValue() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
},

  handleOperation(e) {
    const value = e.currentTarget.dataset.value;
    
    // 直接设置变化量，不累加
    this.setData({
      changeValue: value,
      displayScore: this.data.lastScore + value,
      inputScore: '' // 清空手动输入
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
      // 计算变化量
      const changeValue = score - this.data.lastScore;
      
      this.setData({
        displayScore: score,
        changeValue: changeValue,
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
    
    if (!this.validateTimeFormat(this.data.currentTime)) {
      wx.showToast({
        title: '时间格式错误，请使用YYYY-MM-DD HH:MM格式',
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
      wx.showToast({
        title: '该时间已存在记录，请选择其他时间',
        icon: 'none'
      });
      return;
    } else {
      // 创建新记录 - 正确计算时间戳
      const [datePart, timePart] = this.data.currentTime.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hours, minutes] = timePart.split(':');
      
      // 使用本地时间创建Date对象
      const timestamp = new Date(
        parseInt(year),
        parseInt(month) - 1, // 月份从0开始
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      ).getTime();
      
      const newRecord = {
        id: Date.now().toString(),
        score: this.data.displayScore, // 使用显示分数
        time: this.data.currentTime,
        timestamp: timestamp
      };
      
      records[seasonId].push(newRecord);
      wx.showToast({
        title: '记录保存成功',
        icon: 'success'
      });
    }
    
    wx.setStorageSync('records', records);
    
    // 更新lastScore为当前保存的分数，重置变化量
    this.setData({
      lastScore: this.data.displayScore,
      currentScore: this.data.displayScore,
      changeValue: 0
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