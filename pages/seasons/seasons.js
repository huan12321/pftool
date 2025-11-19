Page({
  data: {
    seasons: [],
    newSeasonName: '',
    newSeasonInitialScore: 0,
    editingSeasonId: null,
    editingSeasonName: '',
    selectedSeasons: [],
    aiAnalysisResult: '',
    isAnalyzing: false,
    analysisHistory: [],
    allSelected: false, // 新增：全选状态
    currentSeasonId: '' // 新增：当前赛季ID
  },

  onLoad() {
    this.loadSeasons();
    this.setData({
      currentSeasonId: wx.getStorageSync('currentSeasonId') || ''
    });
  },

  loadSeasons() {
    const seasons = wx.getStorageSync('seasons') || [];
    const records = wx.getStorageSync('records') || {};
    
    const seasonsWithStats = seasons.map(season => {
      const seasonRecords = records[season.id] || [];
      const validRecords = seasonRecords.filter(record => record.timestamp !== 0);
      return {
        ...season,
        recordCount: validRecords.length,
        selected: false
      };
    });
    
    // 计算全选状态
    const allSelected = seasonsWithStats.length > 0 && seasonsWithStats.every(season => season.selected);
    
    this.setData({
      seasons: seasonsWithStats,
      editingSeasonId: null,
      editingSeasonName: '',
      selectedSeasons: [],
      allSelected: allSelected
    });
  },

  // 切换赛季选中状态
  toggleSeasonSelection(e) {
    const seasonId = e.currentTarget.dataset.id;
    const seasons = this.data.seasons.map(season => {
      if (season.id === seasonId) {
        return {
          ...season,
          selected: !season.selected
        };
      }
      return season;
    });
    
    const selectedSeasons = seasons.filter(season => season.selected).map(season => season.id);
    const allSelected = seasons.length > 0 && seasons.every(season => season.selected);
    
    this.setData({
      seasons,
      selectedSeasons,
      allSelected
    });
  },

  // 全选/取消全选
  toggleSelectAll() {
    const seasons = this.data.seasons.map(season => ({
      ...season,
      selected: !this.data.allSelected
    }));
    
    const selectedSeasons = !this.data.allSelected ? seasons.map(season => season.id) : [];
    
    this.setData({
      seasons,
      selectedSeasons,
      allSelected: !this.data.allSelected
    });
  },

  // 获取选中赛季的数据
  getSelectedSeasonsData() {
    const records = wx.getStorageSync('records') || {};
    const selectedSeasonsData = [];
    
    this.data.selectedSeasons.forEach(seasonId => {
      const season = this.data.seasons.find(s => s.id === seasonId);
      if (season) {
        const seasonRecords = (records[seasonId] || [])
          .filter(record => record.timestamp !== 0)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        selectedSeasonsData.push({
          seasonName: season.name,
          initialScore: season.initialScore,
          recordCount: season.recordCount,
          records: seasonRecords
        });
      }
    });
    
    return selectedSeasonsData;
  },

  // 调用DeepSeek API进行分析 - 流式版本
  analyzeWithDeepSeek() {
    if (this.data.selectedSeasons.length === 0) {
      wx.showToast({
        title: '请先选择要分析的赛季',
        icon: 'none'
      });
      return;
    }

    this.setData({ 
      isAnalyzing: true,
      aiAnalysisResult: '' // 清空之前的结果
    });
    
    try {
      const selectedData = this.getSelectedSeasonsData();
      
      // 构建分析提示词
      const prompt = this.buildAnalysisPrompt(selectedData);
      
      // 调用DeepSeek API - 流式版本
      this.callDeepSeekAPIStream(prompt);
      
    } catch (error) {
      console.error('分析准备失败:', error);
      wx.showToast({
        title: '分析准备失败',
        icon: 'none'
      });
      this.setData({ isAnalyzing: false });
    }
  },

  // 构建分析提示词 - 优化版本
buildAnalysisPrompt(seasonsData) {
  let prompt = `请基于以下赛季数据，从时间趋势、胜率分析和分数变化等角度进行专业分析：\n\n`;
  
  seasonsData.forEach((season, index) => {
    prompt += `## 赛季${index + 1}: ${season.seasonName}\n`;
    prompt += `- 初始分数: ${season.initialScore}\n`;
    prompt += `- 总记录数: ${season.recordCount}条\n`;
    
    if (season.records.length > 0) {
      const records = season.records;
      const firstRecord = records[0];
      const lastRecord = records[records.length - 1];
      const totalChange = lastRecord.score - firstRecord.score;
      
      // 计算胜率相关数据
      let wins = 0;
      let totalGames = 0;
      let scoreChanges = [];
      
      // 分析每场比赛的胜负和分数变化
      for (let i = 1; i < records.length; i++) {
        const current = records[i];
        const previous = records[i - 1];
        const scoreChange = current.score - previous.score;
        scoreChanges.push(scoreChange);
        
        if (scoreChange > 0) {
          wins++;
        }
        totalGames++;
      }
      
      const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : 0;
      const averageChange = scoreChanges.length > 0 ? 
        (scoreChanges.reduce((a, b) => a + b, 0) / scoreChanges.length).toFixed(1) : 0;
      
      // 计算波动性（标准差）
      const variance = scoreChanges.reduce((acc, val) => acc + Math.pow(val - averageChange, 2), 0) / scoreChanges.length;
      const volatility = Math.sqrt(variance).toFixed(1);
      
      prompt += `- 最终分数: ${lastRecord.score}\n`;
      prompt += `- 净变化: ${totalChange}分\n`;
      prompt += `- 估算胜率: ${winRate}% (${wins}胜/${totalGames}场)\n`;
      prompt += `- 场均变化: ${averageChange}分\n`;
      prompt += `- 分数波动: ${volatility}分\n`;
      
      // 时间分布分析
      if (records.length > 1) {
        const timeSpan = (lastRecord.timestamp - firstRecord.timestamp) / (1000 * 60 * 60 * 24); // 天数
        const gamesPerDay = (totalGames / timeSpan).toFixed(2);
        prompt += `- 时间跨度: ${timeSpan.toFixed(1)}天\n`;
        prompt += `- 日均场次: ${gamesPerDay}场\n`;
      }
      
      // 近期表现
      prompt += `- 近期表现:\n`;
      const recentRecords = records.slice(-5);
      recentRecords.forEach((record, i) => {
        const trend = i > 0 ? (record.score > recentRecords[i-1].score ? '↗️' : '↘️') : '';
        prompt += `  * ${record.time}: ${record.score}分 ${trend}\n`;
      });
      
      // 最佳和最差表现
      const maxScore = Math.max(...records.map(r => r.score));
      const minScore = Math.min(...records.map(r => r.score));
      prompt += `- 赛季最高: ${maxScore}分\n`;
      prompt += `- 赛季最低: ${minScore}分\n`;
    }
    prompt += '\n';
  });
  
  prompt += `请从以下专业角度进行深度分析：

## 1. 时间趋势分析
- 各赛季的时间分布密度（比赛频率）
- 活跃期与休息期的表现对比
- 长期趋势（进步/退步/稳定）

## 2. 胜率与稳定性分析
- 各赛季胜率对比及原因分析
- 分数波动性评估（稳定型/波动型选手）
- 风险承受能力分析

## 3. 分数效率分析
- 场均得分效率对比
- 分数增长的可持续性
- 瓶颈期识别与突破建议

## 4. 多赛季对比分析
- 各赛季表现的相对优劣
- 进步或退步的关键时间点
- 赛季间的连贯性和变化趋势

## 5. 个性化改进建议
- 基于数据的具体训练建议
- 风险管理策略（针对波动大的赛季）
- 时间安排优化（针对活跃度）

## 6. 综合评级与预测
- 当前实力水平评估
- 潜在提升空间预测
- 下赛季目标设定建议

请用中文回复，分析要：
- 数据驱动，引用具体数值支持观点
- 实用性强，给出可操作的建议
- 对比明确，突出各赛季特点
- 语言专业但易懂，避免过于学术化`;
  
  return prompt;
},

  // 调用DeepSeek API - 流式版本
  callDeepSeekAPIStream(prompt) {
    const API_TOKEN = 'sk-44f6bf235c4147baa464ca36be614b9f';
    const API_URL = 'https://api.deepseek.com/chat/completions';
    
    // 创建请求任务
    const requestTask = wx.request({
      url: API_URL,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      data: {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true, // 开启流式传输
        max_tokens: 2000,
        temperature: 0.7
      },
      enableChunked: true, // 启用分块传输
      success: (res) => {
        // 流式请求的success回调在连接建立时就会触发
        console.log('流式连接已建立');
      },
      fail: (err) => {
        console.error('API请求失败:', err);
        this.setData({ isAnalyzing: false });
        wx.showToast({
          title: '请求失败，请检查网络',
          icon: 'none'
        });
      }
    });

    let fullContent = '';
    let buffer = '';

    // 监听数据块接收
    requestTask.onChunkReceived((chunk) => {
      try {
        // 将ArrayBuffer转换为字符串
        const chunkString = this.arrayBufferToString(chunk.data);
        buffer += chunkString;
        
        // 处理完整的数据行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最后一行可能不完整，保留到下次处理
        
        lines.forEach(line => {
          line = line.trim();
          if (line === '') return;
          if (line === 'data: [DONE]') return;
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6); // 去掉 "data: " 前缀
              const data = JSON.parse(jsonStr);
              
              if (data.choices && data.choices[0] && data.choices[0].delta) {
                const content = data.choices[0].delta.content;
                if (content) {
                  fullContent += content;
                  // 实时更新显示内容
                  this.setData({
                    aiAnalysisResult: fullContent
                  });
                }
              }
            } catch (e) {
              console.warn('解析JSON失败:', e, '原始数据:', line);
            }
          }
        });
        
      } catch (error) {
        console.error('处理数据块时出错:', error);
      }
    });

    // 监听请求完成
    requestTask.onHeadersReceived(() => {
      console.log('请求头已接收');
    });

    // 保存请求任务引用，以便后续可能的中断操作
    this.deepSeekRequestTask = requestTask;
  },

  // ArrayBuffer 转字符串
  arrayBufferToString(arrayBuffer) {
    try {
      // 方法1: 使用TextDecoder（推荐）
      if (typeof TextDecoder !== 'undefined') {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(arrayBuffer);
      }
      
      // 方法2: 备用方案
      const uint8Array = new Uint8Array(arrayBuffer);
      let string = '';
      for (let i = 0; i < uint8Array.length; i++) {
        string += String.fromCharCode(uint8Array[i]);
      }
      
      // 尝试解码UTF-8
      try {
        return decodeURIComponent(escape(string));
      } catch (e) {
        return string; // 如果UTF-8解码失败，返回原始字符串
      }
    } catch (error) {
      console.error('UTF-8解码失败:', error);
      return '';
    }
  },

// 停止分析（可选功能）
stopAnalysis() {
  if (this.deepSeekRequestTask) {
    this.deepSeekRequestTask.abort();
    this.deepSeekRequestTask = null;
  }
  this.setData({ isAnalyzing: false });
  wx.showToast({
    title: '分析已停止',
    icon: 'none'
  });
},

  

  // 清除当前分析结果
  clearAnalysisResult() {
    this.setData({
      aiAnalysisResult: ''
    });
  },

  // 删除历史分析记录
  deleteAnalysisRecord(e) {
    const analysisId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条分析记录吗？',
      success: (res) => {
        if (res.confirm) {
          const updatedHistory = this.data.analysisHistory.filter(item => item.id !== analysisId);
          this.setData({
            analysisHistory: updatedHistory
          });
          this.saveAnalysisHistory();
          
          wx.showToast({
            title: '记录已删除',
            icon: 'success'
          });
        }
      }
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

  // 开始编辑赛季名称
  startEditSeason(e) {
    const seasonId = e.currentTarget.dataset.id;
    const season = this.data.seasons.find(s => s.id === seasonId);
    
    if (season) {
      this.setData({
        editingSeasonId: seasonId,
        editingSeasonName: season.name
      });
    }
  },

  // 处理编辑输入
  handleEditInput(e) {
    this.setData({
      editingSeasonName: e.detail.value
    });
  },

  // 保存编辑的赛季名称
  saveEditSeason() {
    const { editingSeasonId, editingSeasonName } = this.data;
    
    if (!editingSeasonId || !editingSeasonName.trim()) {
      wx.showToast({
        title: '赛季名称不能为空',
        icon: 'none'
      });
      return;
    }

    let seasons = wx.getStorageSync('seasons') || [];
    seasons = seasons.map(season => {
      if (season.id === editingSeasonId) {
        return {
          ...season,
          name: editingSeasonName.trim()
        };
      }
      return season;
    });
    
    wx.setStorageSync('seasons', seasons);
    
    this.loadSeasons(); // 重新加载赛季列表
    
    wx.showToast({
      title: '赛季名称已更新',
      icon: 'success'
    });
  },

  // 取消编辑
  cancelEditSeason() {
    this.setData({
      editingSeasonId: null,
      editingSeasonName: ''
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
  
  // 其他方法保持不变...
  // ... (保持原有的 previewFile, shareFileToFriend 等方法)
})