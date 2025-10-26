Page({
  data: {
    seasons: [],
    totalRecords: 0
  },

  onLoad() {
    this.loadDataInfo();
  },

  onShow() {
    this.loadDataInfo();
  },

  loadDataInfo() {
    const seasons = wx.getStorageSync('seasons') || [];
    const records = wx.getStorageSync('records') || {};
    
    // 计算总记录数
    let totalRecords = 0;
    seasons.forEach(season => {
      totalRecords += (records[season.id] || []).length;
    });
    
    this.setData({
      seasons,
      totalRecords
    });
  },

  // 导出并直接分享给好友
  exportAndShare() {
    const seasons = wx.getStorageSync('seasons') || [];
    const records = wx.getStorageSync('records') || {};
    
    if (this.data.totalRecords === 0) {
      wx.showToast({
        title: '没有数据可导出',
        icon: 'none'
      });
      return;
    }
    
    // 构建CSV内容
    let csvContent = '赛季ID,赛季名称,初始分数,记录ID,分数,时间\n';
    
    seasons.forEach(season => {
      const seasonRecords = records[season.id] || [];
      seasonRecords.forEach(record => {
        csvContent += `${season.id},${season.name},${season.initialScore},${record.id},${record.score},${record.time}\n`;
      });
    });
    
    // 添加统计信息
    csvContent += `\n统计信息\n`;
    csvContent += `导出时间,${new Date().toLocaleString()}\n`;
    csvContent += `总赛季数,${seasons.length}\n`;
    csvContent += `总记录数,${this.data.totalRecords}\n`;
    
    // 保存文件
    const fs = wx.getFileSystemManager();
    const timestamp = new Date().getTime();
    const filePath = `${wx.env.USER_DATA_PATH}/game_scores_${timestamp}.csv`;
    
    fs.writeFile({
      filePath,
      data: csvContent,
      encoding: 'utf8',
      success: () => {
        // 直接调起分享文件
        wx.shareFileMessage({
          filePath: filePath,
          fileName: `游戏分数记录_${timestamp}.csv`,
          success: () => {
            wx.showToast({
              title: '已调起分享',
              icon: 'success'
            });
          },
          fail: (err) => {
            console.error('分享文件失败', err);
            // 备用方案：复制到剪贴板
            this.fallbackToClipboard(csvContent);
          }
        });
      },
      fail: (err) => {
        console.error('写入文件失败', err);
        this.fallbackToClipboard(csvContent);
      }
    });
  },

  // 备用方案：复制到剪贴板
  fallbackToClipboard(csvContent) {
    wx.setClipboardData({
      data: csvContent,
      success: () => {
        wx.showModal({
          title: '分享方式',
          content: '数据已复制到剪贴板！\n\n请打开微信聊天窗口，粘贴发送给好友。',
          showCancel: false,
          confirmText: '知道了'
        });
      },
      fail: () => {
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
      }
    });
  },

  // 快速分享当前赛季
  shareCurrentSeason() {
    const seasons = wx.getStorageSync('seasons') || [];
    const records = wx.getStorageSync('records') || {};
    const currentSeasonId = wx.getStorageSync('currentSeasonId');
    
    if (!currentSeasonId) {
      wx.showToast({
        title: '请先选择赛季',
        icon: 'none'
      });
      return;
    }
    
    const currentSeason = seasons.find(s => s.id === currentSeasonId);
    const seasonRecords = records[currentSeasonId] || [];
    
    if (seasonRecords.length === 0) {
      wx.showToast({
        title: '当前赛季没有数据',
        icon: 'none'
      });
      return;
    }

    let csvContent = '时间,分数,连胜状态\n';
    
    // 按时间排序并分析连胜
    const sortedRecords = [...seasonRecords].sort((a, b) => a.timestamp - b.timestamp);
    const analyzedRecords = this.analyzeStreaksForExport(sortedRecords);
    
    analyzedRecords.forEach(record => {
      csvContent += `${record.time},${record.score},${record.streak}\n`;
    });
    
    // 添加统计
    const scores = sortedRecords.map(r => r.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    
    csvContent += `\n统计信息\n`;
    csvContent += `赛季名称,${currentSeason.name}\n`;
    csvContent += `记录数量,${sortedRecords.length}\n`;
    csvContent += `最高分数,${maxScore}\n`;
    csvContent += `最低分数,${minScore}\n`;
    csvContent += `平均分数,${avgScore}\n`;
    csvContent += `导出时间,${new Date().toLocaleString()}\n`;
    
    const timestamp = new Date().getTime();
    const filePath = `${wx.env.USER_DATA_PATH}/${currentSeason.name}_${timestamp}.csv`;
    
    const fs = wx.getFileSystemManager();
    fs.writeFile({
      filePath,
      data: csvContent,
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({
          filePath: filePath,
          fileName: `${currentSeason.name}_分数记录.csv`,
          success: () => {
            wx.showToast({
              title: '已调起分享',
              icon: 'success'
            });
          },
          fail: (err) => {
            this.fallbackToClipboard(csvContent);
          }
        });
      },
      fail: (err) => {
        this.fallbackToClipboard(csvContent);
      }
    });
  },

  // 为导出分析连胜数据
  analyzeStreaksForExport(records) {
    if (records.length <= 1) return records.map(r => ({...r, streak: ''}));
    
    const streakCounts = new Array(records.length).fill(0);
    const streakTypes = new Array(records.length).fill('');
    
    for (let i = 1; i < records.length; i++) {
      const curr = records[i];
      const prev = records[i - 1];
      
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
    
    const streaks = new Array(records.length).fill('');
    for (let i = 0; i < records.length; i++) {
      if (streakCounts[i] > 0 && 
          (i === records.length - 1 || streakCounts[i + 1] <= streakCounts[i])) {
        streaks[i] = `${streakTypes[i] === 'win' ? '连胜' : '连败'}${streakCounts[i]}`;
      }
    }
    
    return records.map((record, index) => ({
      ...record,
      streak: streaks[index] || ''
    }));
  },

  // 分享图片格式（备用）
  shareAsImage() {
    wx.showModal({
      title: '分享提示',
      content: '建议使用CSV文件分享，这样好友可以直接导入数据。\n\n如需分享图片，请先截图图表页面。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

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
      }
    });
  },

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
        
        recordsMap[seasonId].push({
          id: recordId,
          score: parseInt(score) || 0,
          time: time,
          timestamp: new Date(time).getTime()
        });
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
          
          this.loadDataInfo();
          
          wx.showToast({
            title: '导入成功',
            icon: 'success'
          });
        }
      }
    });
  }
})