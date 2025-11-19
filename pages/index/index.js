Page({
  data: {
    seasons: [],
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
    ],
    lastScore: 0,
    changeValue: 0,
    displayScore: 0,
    winStreak: 0, // 当前连胜场数
    lastResult: null // 上一局结果：'win' 或 'loss'
  },

  onLoad() {
    this.loadCurrentSeason();
    this.calculateWinStreak(); // 计算连胜信息
  },

  onShow() {
    this.loadCurrentSeason();
    this.calculateWinStreak(); // 每次页面显示时重新计算
  },

  // 从历史记录计算连胜信息
  calculateWinStreak() {
    if (!this.data.currentSeason) {
      this.setData({
        winStreak: 0,
        lastResult: null
      });
      return;
    }

    const records = wx.getStorageSync('records') || {};
    const seasonRecords = records[this.data.currentSeason.id] || [];
    
    if (seasonRecords.length === 0) {
      this.setData({
        winStreak: 0,
        lastResult: null
      });
      return;
    }

    // 按时间正序排列
    const sortedRecords = [...seasonRecords].sort((a, b) => a.timestamp - b.timestamp);
    
    let currentStreak = 0;
    let lastResult = null;

    // 从最新的记录开始向前计算连胜
    for (let i = sortedRecords.length - 1; i > 0; i--) {
      const currentRecord = sortedRecords[i];
      const prevRecord = sortedRecords[i - 1];
      
      if (currentRecord.score > prevRecord.score) {
        // 胜利
        if (lastResult === 'win' || lastResult === null) {
          currentStreak++;
          lastResult = 'win';
        } else {
          // 遇到失败，终止计算
          break;
        }
      } else if (currentRecord.score < prevRecord.score) {
        // 失败
        if (lastResult === 'lose' || lastResult === null) {
          currentStreak = 0; // 对于失败，连胜重置为0
          lastResult = 'lose';
        } else {
          // 遇到胜利，终止计算
          break;
        }
      } else {
        // 平局，不影响连胜
        continue;
      }
    }

    // 如果只有一条记录，无法判断胜负
    if (sortedRecords.length === 1) {
      currentStreak = 0;
      lastResult = null;
    }

    this.setData({
      winStreak: currentStreak,
      lastResult: lastResult
    });
  },

  // 分析连胜连败（参考你另一个页面的实现）
  analyzeStreaks(records) {
    if (records.length <= 1) return records.map(r => ({...r, streak: ''}));
    
    const sortedByTime = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const streakCounts = new Array(sortedByTime.length).fill(0);
    const streakTypes = new Array(sortedByTime.length).fill('');
    
    // 计算每场比赛的连胜连败数
    for (let i = 1; i < sortedByTime.length; i++) {
      const curr = sortedByTime[i];
      const prev = sortedByTime[i - 1];
      
      if (curr.score > prev.score) {
        if (streakTypes[i - 1] === 'win') {
          streakCounts[i] = streakCounts[i - 1] + 1;
        } else {
          streakCounts[i] = 1;
        }
        streakTypes[i] = 'win';
      } else if (curr.score < prev.score) {
        if (streakTypes[i - 1] === 'lose') {
          streakCounts[i] = streakCounts[i - 1] + 1;
        } else {
          streakCounts[i] = 1;
        }
        streakTypes[i] = 'lose';
      }
    }
    
    // 只在连胜/连败的最高点显示标记
    const streaks = new Array(sortedByTime.length).fill('');
    for (let i = 0; i < sortedByTime.length; i++) {
      if (streakCounts[i] > 0 && 
          (i === sortedByTime.length - 1 || streakCounts[i + 1] <= streakCounts[i])) {
        streaks[i] = `${streakTypes[i] === 'win' ? '连胜' : '连败'}${streakCounts[i]}场`;
      }
    }
    
    const streakMap = {};
    for (let i = 0; i < sortedByTime.length; i++) {
      streakMap[sortedByTime[i].id] = streaks[i];
    }
    
    return records.map(record => {
      const streak = streakMap[record.id] || '';
      let streakType = '';
      
      if (streak) {
        if (streak.includes('连胜')) {
          streakType = 'win';
        } else if (streak.includes('连败')) {
          streakType = 'lose';
        }
      }
      
      return {
        ...record,
        streak: streak,
        streakType: streakType
      };
    });
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
        seasons,
        currentSeason,
        lastScore: currentScore,
        currentScore: currentScore,
        displayScore: currentScore,
        changeValue: 0
      });

      // 重新计算连胜信息
      this.calculateWinStreak();
    } else {
      this.setData({
        currentSeason: null,
        lastScore: 0,
        currentScore: 0,
        displayScore: 0,
        changeValue: 0,
        winStreak: 0,
        lastResult: null
      });
      wx.showToast({
        title: '请先创建赛季',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 处理胜利
  handleWin() {
    let winValue = 10; // 默认值
    
    // 根据连胜情况计算分数
    if (this.data.lastResult === 'loss' || this.data.lastResult === null) {
      // 上一把为输或没有上一把，+10
      winValue = 10;
    } else {
      // 根据连胜场数计算
      switch (this.data.winStreak) {
        case 0:
          winValue = 10;
          break;
        case 1:
          winValue = 13;
          break;
        case 2:
          winValue = 16;
          break;
        case 3:
          winValue = 19;
          break;
        default:
          winValue = 22; // 4局或以上
      }
    }
    
    // 更新显示
    this.setData({
      changeValue: winValue,
      displayScore: this.data.lastScore + winValue,
      inputScore: ''
    });
  },

  // 处理失败
  handleLoss() {
    // 失败固定-10分
    this.setData({
      changeValue: -10,
      displayScore: this.data.lastScore - 10,
      inputScore: ''
    });
  },

  // 原有的操作处理方法
  handleOperation(e) {
    const value = e.currentTarget.dataset.value;
    
    this.setData({
      changeValue: value,
      displayScore: this.data.lastScore + value,
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

  // 添加时间输入处理函数
  handleTimeInput(e) {
    this.setData({
      currentTime: e.detail.value
    });
  },

  saveRecord() {
    if (!this.data.currentSeason) {
      wx.showToast({
        title: '请先选择赛季',
        icon: 'none'
      });
      return;
    }
    let finalTime = this.data.currentTime;
    if (!finalTime || finalTime.trim() === '') {
      finalTime = this.getCurrentTimeString();
    } else {
      if (!this.validateTimeFormat(finalTime)) {
        wx.showToast({
          title: '时间格式错误，请使用YYYY-MM-DD HH:MM格式',
          icon: 'none'
        });
        return;
      }
    }
    
    const records = wx.getStorageSync('records') || {};
    const seasonId = this.data.currentSeason.id;
    
    if (!records[seasonId]) {
      records[seasonId] = [];
    }
    const existingRecordIndex = records[seasonId].findIndex(record => record.time === finalTime);
    
    if (existingRecordIndex !== -1) {
      wx.showToast({
        title: '该时间已存在记录，请选择其他时间',
        icon: 'none'
      });
      return;
    }
    
    const [datePart, timePart] = finalTime.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes] = timePart.split(':');
    
    const timestamp = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    ).getTime();
    
    const newRecord = {
      id: Date.now().toString(),
      score: this.data.displayScore,
      time: finalTime,
      timestamp: timestamp
    };
    
    records[seasonId].push(newRecord);
    wx.setStorageSync('records', records);
    
    wx.showToast({
      title: '记录保存成功',
      icon: 'success'
    });
    
    // 更新分数显示，重置变化量，清空时间输入
    this.setData({
      lastScore: this.data.displayScore,
      currentScore: this.data.displayScore,
      changeValue: 0,
      currentTime: ''
    });

    // 重新计算连胜信息
    this.calculateWinStreak();
  },

  // 其他辅助方法保持不变
  getCurrentTimeString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },
  
  validateTimeFormat(timeStr) {
    if (!timeStr || timeStr.trim() === '') {
      return true;
    }
    
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

  onSeasonChange(e) {
    const seasonIndex = e.detail.value;
    const seasons = wx.getStorageSync('seasons') || [];
    wx.setStorageSync('currentSeasonId', seasons[seasonIndex].id);
    this.setData({
      currentSeason: seasons[seasonIndex]
    }, () => {
      this.onLoad();
    });
  }
});