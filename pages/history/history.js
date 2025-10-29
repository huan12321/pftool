const app = getApp();
const wxCharts = require('../utils/wxcharts.js');

Page({
  data: {
    seasons: [],
    currentSeasonId: '',
    currentSeasonName: '',
    records: [],
    analyzedRecords: [],
    editDialogVisible: false,
    currentEditRecord: null,
    editScore: '',
    viewMode: 'streak', // 'streak', 'hourly', 'chart'
    hourlyStats: [], // 分时段统计数据
    chart: null, // 图表实例
    chartData: [], // 图表数据
    // 新增：时间范围选择相关数据
    timeRangeOptions: [
      { label: '最近1天', value: 1 },
      { label: '最近3天', value: 3 },
      { label: '最近7天', value: 7 },
      { label: '最近15天', value: 15 },
      { label: '最近30天', value: 30 },
      { label: '最近60天', value: 60 },
      { label: '最近100天', value: 100 },
      { label: '全部数据', value: 0 }
    ],
    selectedTimeRange: 0, // 默认显示最近3天
    filteredRecords: [], // 筛选后的记录
    showTimeRangePicker: false // 控制时间范围选择器显示
  },

  onLoad() {
    console.log('页面加载');
    this.loadSeasons();
    
    // 检查 wxCharts 是否加载成功
    console.log('wxCharts:', wxCharts);
  },

  onShow() {
    this.loadSeasons();
  },

  onUnload() {
    // 清理图表实例
    if (this.data.chart) {
      this.data.chart = null;
    }
  },

  loadSeasons() {
    const seasons = wx.getStorageSync('seasons') || [];
    let currentSeasonId = wx.getStorageSync('currentSeasonId');
    let currentSeasonName = '';
    
    if (!currentSeasonId && seasons.length > 0) {
      currentSeasonId = seasons[0].id;
      wx.setStorageSync('currentSeasonId', currentSeasonId);
    }
    
    for (let i = 0; i < seasons.length; i++) {
      if (seasons[i].id === currentSeasonId) {
        currentSeasonName = seasons[i].name;
        break;
      }
    }
    
    this.setData({
      seasons,
      currentSeasonId,
      currentSeasonName
    }, () => {
      this.loadRecords();
    });
  },

  loadRecords() {
    if (!this.data.currentSeasonId) return;
    
    const records = wx.getStorageSync('records') || {};
    let seasonRecords = records[this.data.currentSeasonId] || [];
    
    // 过滤掉初始记录（时间戳为0的记录）
    seasonRecords = seasonRecords.filter(record => record.timestamp !== 0);
    
    // 按时间倒序排列
    seasonRecords.sort((a, b) => b.timestamp - a.timestamp);
    
    // 根据选择的时间范围筛选记录
    const filteredRecords = this.filterRecordsByTimeRange(seasonRecords);
    
    // 分析连胜连败
    const analyzedRecords = this.analyzeStreaks(seasonRecords);
    
    // 计算分时段统计数据
    const hourlyStats = this.calculateHourlyStats(seasonRecords);
    
    // 准备图表数据
    const chartData = this.prepareChartData(filteredRecords);
    
    this.setData({
      records: seasonRecords,
      filteredRecords: filteredRecords,
      analyzedRecords,
      hourlyStats,
      chartData
    }, () => {
      // 如果当前是图表模式，初始化图表
      if (this.data.viewMode === 'chart') {
        this.initChart();
      }
    });
  },

  // 根据时间范围筛选记录
filterRecordsByTimeRange(records) {
  const { selectedTimeRange, timeRangeOptions } = this.data;
  
  // 根据选中的索引获取对应的天数
  const selectedOption = timeRangeOptions[selectedTimeRange];
  if (!selectedOption) {
    console.error('无效的时间范围选项:', selectedTimeRange);
    return [];
  }
  
  const days = selectedOption.value;
  const now = new Date().getTime();
  const timeRangeMs = days * 24 * 60 * 60 * 1000; // 转换为毫秒
  const cutoffTime = now - timeRangeMs;
  debugger;
  return records.filter(record => record.timestamp >= cutoffTime);
},

  prepareChartData(records) {
    if (records.length === 0) return [];
    
    // 按时间正序排列用于图表显示
    const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);
    
    // 确保数据都是数字类型
    const chartData = sortedRecords.map(record => {
      // 简化时间显示
      const date = new Date(record.timestamp);
      const timeLabel = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      return {
        time: timeLabel,
        score: Number(record.score), // 确保是数字
        timestamp: record.timestamp
      };
    });

    console.log('图表数据:', chartData);
    return chartData;
  },

  initChart() {
    if (this.data.chartData.length === 0) {
      console.log('没有图表数据');
      return;
    }
    
    console.log('开始初始化柱状图，数据量:', this.data.chartData.length);
    console.log('seriesData:', this.data.chartData.map(item => item.score));

    // 销毁之前的图表
    if (this.data.chart) {
      this.data.chart = null;
    }
    
    // 使用延时确保 canvas 已经渲染
    setTimeout(() => {
      this.createColumnChart();
    }, 300);
  },

  createColumnChart() {
    const systemInfo = wx.getSystemInfoSync();
    const windowWidth = systemInfo.windowWidth;
    
    const categories = this.data.chartData.map(item => item.time);
    const seriesData = this.data.chartData.map(item => item.score);
    
    // 计算数据范围
    const minScore = Math.min(...seriesData);
    const maxScore = Math.max(...seriesData);
    const range = maxScore - minScore;
    
    console.log('数据范围:', { minScore, maxScore, range });
    
    try {
      const chartWidth = windowWidth - 40;
      const chartHeight = 250;
      
      // 创建柱状图
      const chart = new wxCharts({
        canvasId: 'scoreChart',
        type: 'column', // 改为柱状图
        categories: categories,
        animation: false,
        background: '#f8f9fa',
        series: [{
          name: '分数',
          data: seriesData,
          color: '#1677ff',
          format: function (val) {
            return val.toFixed(0);
          }
        }],
        xAxis: {
          disableGrid: false,
          gridColor: '#e8e8e8',
          fontColor: '#666666',
          fontSize: 12,
          // 根据数据量调整标签显示
          labelCount: Math.min(8, categories.length),
          // 标签旋转避免重叠
          rotateLabel: categories.length > 6,
          // 确保X轴显示
          axisLine: true,
          axisLineColor: '#666666',
          title: '时间',
          titleFontColor: '#666666',
          titleFontSize: 14
        },
        yAxis: {
          disableGrid: false,
          gridColor: '#e8e8e8',
          splitNumber: 5,
          min: Math.max(0, Math.floor(minScore - range * 0.1)),
          max: Math.ceil(maxScore + range * 0.1),
          format: function (val) {
            return val.toFixed(0);
          },
          axisLine: true,
          axisLineColor: '#666666',
          title: '分数',
          titleFontColor: '#666666',
          titleFontSize: 14,
          titleLocation: 'middle'
        },
        width: chartWidth,
        height: chartHeight,
        dataLabel: false,
        enableScroll: false,
        legend: {
          show: false
        },
        extra: {
          column: {
            // 柱状图宽度配置
            width: Math.max(10, (chartWidth - 60) / Math.max(categories.length, 1) * 0.6)
          }
        },
        padding: [15, 15, 15, 15]
      });
      
      this.setData({
        chart: chart
      });
      
      console.log('柱状图创建成功');
      
    } catch (error) {
      console.error('创建柱状图失败:', error);
      // 尝试简化版柱状图
      this.createSimpleColumnChart();
    }
  },

  // 简化版柱状图
  createSimpleColumnChart() {
    const systemInfo = wx.getSystemInfoSync();
    const windowWidth = systemInfo.windowWidth;
    
    const categories = this.data.chartData.map(item => item.time);
    const seriesData = this.data.chartData.map(item => item.score);
    
    try {
      const chart = new wxCharts({
        canvasId: 'scoreChart',
        type: 'column',
        categories: categories,
        series: [{
          name: '分数',
          data: seriesData,
          color: '#1677ff'
        }],
        xAxis: {
          gridColor: '#eeeeee',
          fontColor: '#666666'
        },
        yAxis: {
          gridColor: '#eeeeee',
          fontColor: '#666666',
          title: '分数',
          format: function (val) {
            return val.toFixed(0);
          }
        },
        width: windowWidth - 40,
        height: 400,
        dataLabel: false,
        enableScroll: false,
        extra: {
          column: {
            width: 15
          }
        }
      });
      
      this.setData({
        chart: chart
      });
      
      console.log('简化柱状图创建成功');
    } catch (error) {
      console.error('简化柱状图也创建失败:', error);
    }
  },

  // 切换查看模式
  switchViewMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      viewMode: mode
    }, () => {
      if (mode === 'chart') {
        // 确保DOM更新后再初始化图表
        setTimeout(() => {
          this.initChart();
        }, 100);
      }
    });
  },

// 切换时间范围
onTimeRangeChange(e) {
  const selectedIndex = parseInt(e.detail.value); // 这是选中的索引
  this.setData({
    selectedTimeRange: selectedIndex, // 存储索引值
    showTimeRangePicker: false
  }, () => {
    // 重新加载记录（会自动筛选）
    this.loadRecords();
  });
},

  // 显示/隐藏时间范围选择器
  toggleTimeRangePicker() {
    this.setData({
      showTimeRangePicker: !this.data.showTimeRangePicker
    });
  },

// 获取当前时间范围的显示文本
getCurrentTimeRangeText() {
  const { selectedTimeRange, timeRangeOptions } = this.data;
  const option = timeRangeOptions[selectedTimeRange]; // 通过索引获取选项
  return option ? option.label : '选择时间范围';
},

  // 计算分时段统计数据
  calculateHourlyStats(records) {
    const stats = {};
    
    records.forEach(record => {
      if (!record.time) return;
      
      // 解析时间字符串
      const dateTime = record.time.replace('T', ' ');
      const date = new Date(dateTime);
      
      // 获取星期几 (0-6, 0是周日)
      const dayOfWeek = date.getDay();
      // 获取小时 (0-23)
      const hour = date.getHours();
      
      // 判断是工作日还是周末
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0:周日, 6:周六
      const dayType = isWeekend ? 'weekend' : 'weekday';
      
      // 生成唯一键
      const key = `${dayType}_${hour}`;
      
      if (!stats[key]) {
        // 直接在这里生成显示文本
        const timeDesc = isWeekend 
          ? `周末 ${hour}:00-${hour + 1}:00`
          : `工作日 ${hour}:00-${hour + 1}:00`;
        
        stats[key] = {
          dayType: dayType,
          hour: hour,
          timeDesc: timeDesc, // 直接存储显示文本
          total: 0,
          win: 0,
          lose: 0,
          winRate: 0,
          loseRate: 0
        };
      }
      
      // 判断胜负（分数增加为胜，减少为败）
      const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);
      const currentIndex = sortedRecords.findIndex(r => r.id === record.id);
      
      if (currentIndex > 0) {
        const prevRecord = sortedRecords[currentIndex - 1]; // 前一条记录
        if (prevRecord) {
          const isWin = record.score > prevRecord.score;
          const isLose = record.score < prevRecord.score;
          
          stats[key].total++;
          if (isWin) stats[key].win++;
          if (isLose) stats[key].lose++;
        }
      } else {
        // 第一条记录，无法判断胜负，只计数
        stats[key].total++;
      }
    });
    
    // 计算胜率败率并转换为数组
    const result = Object.values(stats).map(stat => {
      if (stat.total > 0) {
        stat.winRate = Math.round((stat.win / stat.total) * 100);
        stat.loseRate = Math.round((stat.lose / stat.total) * 100);
      }
      return stat;
    });
    
    // 按时间段排序：先工作日后周末，再按小时排序
    result.sort((a, b) => {
      if (a.dayType !== b.dayType) {
        return a.dayType === 'weekday' ? -1 : 1;
      }
      return a.hour - b.hour;
    });
    
    return result;
  },

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

  // 导出CSV文件
  exportToCSV() {
    if (this.data.seasonRecords.length === 0) {
      wx.showToast({
        title: '没有数据可导出',
        icon: 'none'
      });
      return;
    }

    // 根据当前视图模式导出不同数据
    let csvContent = '';
    if (this.data.viewMode === 'streak') {
      csvContent = this.generateStreakCSV();
    } else if (this.data.viewMode === 'hourly') {
      csvContent = this.generateHourlyStatsCSV();
    } else {
      csvContent = this.generateChartCSV();
    }
    
    // 复制到剪贴板
    wx.setClipboardData({
      data: csvContent,
      success: () => {
        wx.showToast({
          title: '数据已复制到剪贴板',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  // 生成连胜连败CSV内容
  generateStreakCSV() {
    const records = [...this.data.seasonRecords].sort((a, b) => a.timestamp - b.timestamp);
    
    let csv = '时间,分数,连胜连败状态\n';
    
    records.forEach(record => {
      const time = record.time;
      const score = record.score;
      const streak = record.streak || '';
      
      csv += `${time},${score},${streak}\n`;
    });
    
    return csv;
  },

  // 生成分时段统计CSV内容
  generateHourlyStatsCSV() {
    let csv = '时间段,总场数,胜利场数,失败场数,胜率,败率\n';
    
    this.data.hourlyStats.forEach(stat => {
      const timeDesc = stat.dayType === 'weekday' 
        ? `工作日 ${stat.hour}:00-${stat.hour + 1}:00`
        : `周末 ${stat.hour}:00-${stat.hour + 1}:00`;
      
      csv += `${timeDesc},${stat.total},${stat.win},${stat.lose},${stat.winRate}%,${stat.loseRate}%\n`;
    });
    
    return csv;
  },

  // 生成图表数据CSV内容
  generateChartCSV() {
    let csv = '时间,分数\n';
    
    this.data.chartData.forEach(item => {
      csv += `${item.time},${item.score}\n`;
    });
    
    return csv;
  },

  onSeasonChange(e) {
    const seasonId = e.detail.value;
    wx.setStorageSync('currentSeasonId', seasonId);
    this.setData({
      currentSeasonId: seasonId
    }, () => {
      this.loadRecords();
    });
  },
  
  editRecord(e) {
    const recordId = e.currentTarget.dataset.id;
    const record = this.data.seasonRecords.find(r => r.id === recordId);
    
    if (record) {
      this.setData({
        editDialogVisible: true,
        currentEditRecord: record,
        editScore: record.score.toString()
      });
    }
  },
  
  cancelEdit() {
    this.setData({
      editDialogVisible: false,
      currentEditRecord: null,
      editScore: ''
    });
  },
  
  onEditScoreChange(e) {
    this.setData({
      editScore: e.detail.value
    });
  },
  
  confirmEdit() {
    if (!this.data.currentEditRecord) return;
    
    const score = parseInt(this.data.editScore);
    if (isNaN(score) || score < 0 || score > 10000) {
      wx.showToast({
        title: '请输入0-10000之间的数字',
        icon: 'none'
      });
      return;
    }
    
    const records = wx.getStorageSync('records') || {};
    const seasonId = this.data.currentSeasonId;
    
    if (records[seasonId]) {
      const recordIndex = records[seasonId].findIndex(r => r.id === this.data.currentEditRecord.id);
      
      if (recordIndex !== -1) {
        records[seasonId][recordIndex].score = score;
        wx.setStorageSync('records', records);
        
        // 重新加载记录
        this.loadRecords();
        
        this.cancelEdit();
        
        wx.showToast({
          title: '记录已更新',
          icon: 'success'
        });
      }
    }
  },
  
  deleteRecord(e) {
    const recordId = e.currentTarget.dataset.id;
    const that = this;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success(res) {
        if (res.confirm) {
          const records = wx.getStorageSync('records') || {};
          const seasonId = that.data.currentSeasonId;
          
          if (records[seasonId]) {
            records[seasonId] = records[seasonId].filter(r => r.id !== recordId);
            wx.setStorageSync('records', records);
            
            // 重新加载记录
            that.loadRecords();
            
            wx.showToast({
              title: '记录已删除',
              icon: 'success'
            });
          }
        }
      }
    });
  }
});