Page({
  data: {
    
  },

  goToPokemon: function() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  goToRecord: function() {
    wx.navigateTo({
      url: '/pages/record/record'
    });
  },

  goToPlinko: function() {
    wx.navigateTo({
      url: '/pages/plinko/plinko'
    });
  },

  goToOther: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  onLoad(options) {
    
  },
})
