App({
  onLaunch() {
    // 初始化本地存储
    if (!wx.getStorageSync('seasons')) {
      wx.setStorageSync('seasons', []);
    }
    if (!wx.getStorageSync('currentSeasonId')) {
      wx.setStorageSync('currentSeasonId', '');
    }
    if (!wx.getStorageSync('records')) {
      wx.setStorageSync('records', {});
    }
  },
  
  globalData: {
    currentSeason: null
  }
})
