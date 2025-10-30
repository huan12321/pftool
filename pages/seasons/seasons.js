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

  exportSeasonData(e) {
    const seasonId = e.currentTarget.dataset.id;
    const season = this.data.seasons.find(s => s.id === seasonId);
    
    if (!season) return;
    
    const records = wx.getStorageSync('records') || {};
    const seasonRecords = records[seasonId] || [];
    
    if (seasonRecords.length === 0) {
      wx.showToast({
        title: '该赛季没有数据',
        icon: 'none'
      });
      return;
    }
    
    // 构建CSV内容
    let csvContent = '时间,分数\n';
    seasonRecords.forEach(record => {
      csvContent += `${record.time},${record.score}\n`;
    });
    
    const fileName = `${season.name}_数据.csv`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    const fs = wx.getFileSystemManager();
    
    try {
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      // 显示转发选项 - 移除不存在的函数调用
      wx.showActionSheet({
        itemList: ['发送给朋友', '复制内容', '查看文件'],
        success: (res) => {
          switch (res.tapIndex) {
            case 0:
              // 发送给朋友
              this.shareFileToFriend(filePath, fileName);
              break;
            case 1:
              // 复制内容
              wx.setClipboardData({
                data: csvContent,
                success: () => {
                  wx.showToast({
                    title: '已复制到剪贴板',
                    icon: 'success'
                  });
                }
              });
              break;
            case 2:
              // 查看文件
              this.previewFile(filePath);
              break;
          }
        }
      });
      
    } catch (error) {
      console.error('文件保存失败:', error);
      wx.setClipboardData({
        data: csvContent,
        success: () => {
          wx.showToast({
            title: '数据已复制到剪贴板',
            icon: 'success'
          });
        }
      });
    }
  },
  
  // 预览文件
  previewFile(filePath) {
    wx.openDocument({
      filePath: filePath,
      fileType: 'txt', // 使用txt格式更通用
      success: () => {
        console.log('文件预览成功');
      },
      fail: (err) => {
        console.error('文件预览失败:', err);
        wx.showModal({
          title: '文件已保存',
          content: '文件保存成功，但预览失败。您可以在文件管理中查看。',
          showCancel: false
        });
      }
    });
  },
  
  // 分享文件给朋友
  shareFileToFriend(filePath, fileName) {
    // 先检查文件是否存在
    const fs = wx.getFileSystemManager();
    try {
      fs.accessSync(filePath);
      
      // 文件存在，尝试分享
      wx.shareFileMessage({
        filePath: filePath,
        success: () => {
          wx.showToast({
            title: '分享成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('分享失败:', err);
          // 分享失败，提供其他选项
          wx.showActionSheet({
            itemList: ['复制内容', '查看文件'],
            success: (res) => {
              if (res.tapIndex === 0) {
                // 重新读取文件内容进行复制
                try {
                  const content = fs.readFileSync(filePath, 'utf8');
                  wx.setClipboardData({
                    data: content,
                    success: () => {
                      wx.showToast({
                        title: '已复制到剪贴板',
                        icon: 'success'
                      });
                    }
                  });
                } catch (readErr) {
                  wx.showToast({
                    title: '读取文件失败',
                    icon: 'none'
                  });
                }
              } else if (res.tapIndex === 1) {
                this.previewFile(filePath);
              }
            }
          });
        }
      });
      
    } catch (accessErr) {
      console.error('文件不存在:', accessErr);
      wx.showToast({
        title: '文件不存在',
        icon: 'none'
      });
    }
  },
  
  // 或者使用更可靠的图片分享方案
  shareAsImage(season, records) {
    wx.showLoading({ title: '生成图片中' });
    
    // 构建图片内容
    let imageContent = `${season.name}数据统计\n`;
    imageContent += `记录数: ${records.length}条\n`;
    imageContent += `统计时间: ${new Date().toLocaleString()}\n\n`;
    imageContent += '最近记录:\n';
    
    const recentRecords = records.slice(0, 10);
    recentRecords.forEach((record, index) => {
      imageContent += `${index + 1}. ${record.time} - ${record.score}分\n`;
    });
    
    if (records.length > 10) {
      imageContent += `...还有${records.length - 10}条记录`;
    }
    
    // 使用canvas生成图片
    this.generateImage(imageContent).then((imagePath) => {
      wx.hideLoading();
      
      // 分享图片
      wx.shareFileMessage({
        filePath: imagePath,
        success: () => {
          wx.showToast({
            title: '分享成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('图片分享失败:', err);
          // 降级到预览图片
          wx.previewImage({
            urls: [imagePath],
            success: () => {
              wx.showToast({
                title: '请手动保存或分享图片',
                icon: 'none'
              });
            }
          });
        }
      });
      
    }).catch((err) => {
      wx.hideLoading();
      console.error('图片生成失败:', err);
      wx.showToast({
        title: '生成失败，请使用其他方式',
        icon: 'none'
      });
    });
  },
  
  // 生成图片的辅助函数
  generateImage(textContent) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery();
      query.select('#shareCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res[0] || !res[0].node) {
          reject(new Error('Canvas未找到'));
          return;
        }
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const width = 300;
        const height = 400;
        
        // 设置canvas尺寸
        canvas.width = width;
        canvas.height = height;
        
        // 绘制背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // 绘制边框
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, width - 10, height - 10);
        
        // 绘制文本
        ctx.fillStyle = '#333333';
        ctx.font = '14px sans-serif';
        ctx.textBaseline = 'top';
        
        const lines = textContent.split('\n');
        const lineHeight = 20;
        const startY = 20;
        
        lines.forEach((line, index) => {
          ctx.fillText(line, 20, startY + index * lineHeight);
        });
        
        // 生成图片
        wx.canvasToTempFilePath({
          canvas: canvas,
          fileType: 'png',
          quality: 1,
          success: (res) => {
            resolve(res.tempFilePath);
          },
          fail: (err) => {
            reject(err);
          }
        });
      });
    });
  },
// 页面分享配置
onShareAppMessage() {
  return {
    title: '我的赛季数据统计',
    desc: this.data.shareContent || '赛季数据分享',
    path: '/pages/history/history'
  };
},

  // 导出到文件
exportToFile(csvContent, fileName) {
  return new Promise((resolve, reject) => {
    // 方案1: 使用 FileSystemManager 写入文件
    const fileSystemManager = wx.getFileSystemManager();
    
    // 生成临时文件路径
    const tempFilePath = `${wx.env.USER_DATA_PATH}/${fileName}_${Date.now()}.csv`;
    
    try {
      // 写入文件
      fileSystemManager.writeFile({
        filePath: tempFilePath,
        data: csvContent,
        encoding: 'utf8',
        success: () => {
          // 文件写入成功，尝试分享
          wx.shareFileMessage({
            filePath: tempFilePath,
            success: () => {
              console.log('文件分享成功');
              resolve();
            },
            fail: (shareErr) => {
              console.error('文件分享失败:', shareErr);
              // 分享失败，但文件已创建，可以提示用户
              wx.showModal({
                title: '文件已保存',
                content: `文件已保存到: ${tempFilePath}\n您可以在文件管理中查看`,
                showCancel: false,
                success: () => {
                  resolve();
                }
              });
            }
          });
        },
        fail: (writeErr) => {
          console.error('文件写入失败:', writeErr);
          reject(writeErr);
        }
      });
    } catch (error) {
      console.error('文件操作异常:', error);
      reject(error);
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