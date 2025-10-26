Page({
  data: {
    seasons: [],
    newSeasonName: '',
    newSeasonInitialScore: 0
  },

  onLoad() {
    this.loadSeasons();
  },

  loadSeasons() {
    const seasons = wx.getStorageSync('seasons') || [];
    const records = wx.getStorageSync('records') || {};
    
    // 为每个赛季计算记录数量
    const seasonsWithStats = seasons.map(season => {
      const seasonRecords = records[season.id] || [];
      // 过滤掉初始记录
      const validRecords = seasonRecords.filter(record => record.timestamp !== 0);
      return {
        ...season,
        recordCount: validRecords.length
      };
    });
    
    this.setData({
      seasons: seasonsWithStats
    });
  },

  handleNameInput(e) {
    this.setData({
      newSeasonName: e.detail.value
    });
  },

  handleInitialScoreInput(e) {
    const value = parseInt(e.detail.value) || 0;
    this.setData({
      newSeasonInitialScore: value
    });
  },

  createSeason() {
    if (!this.data.newSeasonName.trim()) {
      wx.showToast({
        title: '请输入赛季名称',
        icon: 'none'
      });
      return;
    }

    const seasons = wx.getStorageSync('seasons') || [];
    const records = wx.getStorageSync('records') || {};
    
    const newSeason = {
      id: Date.now().toString(),
      name: this.data.newSeasonName.trim(),
      initialScore: this.data.newSeasonInitialScore,
      createTime: new Date().toISOString()
    };

    seasons.push(newSeason);
    wx.setStorageSync('seasons', seasons);
    
    const initialRecord = {
      id: `initial_${newSeason.id}`,
      score: this.data.newSeasonInitialScore,
      time: '0000-00-00 00:00',
      timestamp: 0
    };
    
    records[newSeason.id] = [initialRecord];
    wx.setStorageSync('records', records);
    
    if (seasons.length === 1) {
      wx.setStorageSync('currentSeasonId', newSeason.id);
    }

    this.setData({
      newSeasonName: '',
      newSeasonInitialScore: 0
    });

    // 重新加载赛季列表
    this.loadSeasons();

    wx.showToast({
      title: '赛季创建成功',
      icon: 'success'
    });
  },

  setAsCurrent(e) {
    const seasonId = e.currentTarget.dataset.id;
    wx.setStorageSync('currentSeasonId', seasonId);
    wx.showToast({
      title: '已设置为当前赛季',
      icon: 'success'
    });
    this.loadSeasons(); // 重新加载以更新按钮状态
  },

  deleteSeason(e) {
    const seasonId = e.currentTarget.dataset.id;
    const that = this;
    
    wx.showModal({
      title: '确认删除',
      content: '删除赛季将同时删除该赛季的所有记录，是否继续？',
      success(res) {
        if (res.confirm) {
          let seasons = wx.getStorageSync('seasons') || [];
          seasons = seasons.filter(s => s.id !== seasonId);
          wx.setStorageSync('seasons', seasons);
          
          const currentSeasonId = wx.getStorageSync('currentSeasonId');
          if (currentSeasonId === seasonId) {
            if (seasons.length > 0) {
              wx.setStorageSync('currentSeasonId', seasons[0].id);
            } else {
              wx.setStorageSync('currentSeasonId', '');
            }
          }
          
          const records = wx.getStorageSync('records') || {};
          if (records[seasonId]) {
            delete records[seasonId];
            wx.setStorageSync('records', records);
          }
          
          that.loadSeasons();
          wx.showToast({
            title: '赛季已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  // 复制赛季ID到剪贴板
  copySeasonId(e) {
    const seasonId = e.currentTarget.dataset.id;
    wx.setClipboardData({
      data: seasonId,
      success: () => {
        wx.showToast({
          title: '赛季ID已复制',
          icon: 'success'
        });
      }
    });
  },

  // 导出单个赛季数据到剪贴板
  exportSeasonData(e) {
    const seasonId = e.currentTarget.dataset.id;
    const season = this.data.seasons.find(s => s.id === seasonId);
    
    if (!season) return;
    
    const records = wx.getStorageSync('records') || {};
    const seasonRecords = records[seasonId] || [];
    
    // 构建CSV内容
    let csvContent = '赛季ID,赛季名称,初始分数,记录ID,分数,时间\n';
    
    seasonRecords.forEach(record => {
      csvContent += `${season.id},${season.name},${season.initialScore},${record.id},${record.score},${record.time}\n`;
    });
    
    // 复制到剪贴板
    wx.setClipboardData({
      data: csvContent,
      success: () => {
        wx.showToast({
          title: `${season.name}数据已复制到剪贴板`,
          icon: 'success',
          duration: 2000
        });
      },
      fail: (err) => {
        console.error('复制失败', err);
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  // 导入数据
  importData() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['.csv'],
      success: res => {
        const tempFilePath = res.tempFiles[0].path;
        const fs = wx.getFileSystemManager();
        
        fs.readFile({
          filePath: tempFilePath,
          encoding: 'utf8',
          success: res => {
            this.parseAndImportCSV(res.data);
          },
          fail: err => {
            console.error('读取文件失败', err);
            wx.showToast({
              title: '读取文件失败',
              icon: 'none'
            });
          }
        });
      },
      fail: err => {
        console.error('选择文件失败', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 解析并导入CSV数据
  parseAndImportCSV(csvData) {
    const lines = csvData.split('\n');
    if (lines.length < 2) {
      wx.showToast({
        title: 'CSV文件格式不正确',
        icon: 'none'
      });
      return;
    }
    
    // 跳过表头
    lines.shift();
    
    const seasonsMap = {};
    const recordsMap = {};
    
    lines.forEach(line => {
      if (!line.trim()) return;
      
      const [seasonId, seasonName, initialScore, recordId, score, time] = line.split(',');
      
      if (!seasonsMap[seasonId]) {
        seasonsMap[seasonId] = {
          id: seasonId,
          name: seasonName,
          initialScore: parseInt(initialScore) || 0,
          createTime: new Date().toISOString()
        };
      }
      
      if (recordId && score && time) {
        if (!recordsMap[seasonId]) {
          recordsMap[seasonId] = [];
        }
        
        // 避免重复记录
        if (!recordsMap[seasonId].some(r => r.id === recordId)) {
          recordsMap[seasonId].push({
            id: recordId,
            score: parseInt(score) || 0,
            time: time,
            timestamp: new Date(time).getTime()
          });
        }
      }
    });
    
    // 确认导入
    wx.showModal({
      title: '确认导入',
      content: `即将导入 ${Object.keys(seasonsMap).length} 个赛季和 ${
        Object.values(recordsMap).reduce((total, records) => total + records.length, 0)
      } 条记录，是否继续？`,
      success: res => {
        if (res.confirm) {
          // 合并数据
          let existingSeasons = wx.getStorageSync('seasons') || [];
          let existingRecords = wx.getStorageSync('records') || {};
          
          // 添加新赛季
          Object.values(seasonsMap).forEach(season => {
            if (!existingSeasons.some(s => s.id === season.id)) {
              existingSeasons.push(season);
            }
          });
          
          // 添加新记录
          Object.keys(recordsMap).forEach(seasonId => {
            if (!existingRecords[seasonId]) {
              existingRecords[seasonId] = [];
            }
            
            recordsMap[seasonId].forEach(record => {
              if (!existingRecords[seasonId].some(r => r.id === record.id)) {
                existingRecords[seasonId].push(record);
              }
            });
          });
          
          // 保存数据
          wx.setStorageSync('seasons', existingSeasons);
          wx.setStorageSync('records', existingRecords);
          
          // 如果是首次导入，设置第一个赛季为当前赛季
          if (existingSeasons.length > 0 && !wx.getStorageSync('currentSeasonId')) {
            wx.setStorageSync('currentSeasonId', existingSeasons[0].id);
          }
          
          this.loadSeasons();
          
          wx.showToast({
            title: '导入成功',
            icon: 'success'
          });
        }
      }
    });
  }
})