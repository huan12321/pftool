Page({
  /**
   * 页面的初始数据
   */
  data: {
    
  },

  /**
   * 跳转到 Pokémon 功能
   */
  goToPokemon: function() {
    // 这里需要跳转到你的 Pokémon 功能主页
    // 假设你的 Pokémon 功能从 index 页面开始
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 跳转到通用记录功能
   */
  goToRecord: function() {
    wx.navigateTo({
      url: '/pages/record/record'
    });
  },

  /**
   * 跳转到其他功能
   */
  goToOther: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    
  },
})