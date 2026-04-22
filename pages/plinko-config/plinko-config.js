Page({
  data: {
    slots: []
  },
  onLoad: function() {
    var saved = wx.getStorageSync("plinko_slots")
    if (saved && saved.length > 0) {
      this.setData({ slots: saved })
    } else {
      this.setData({ slots: ["选项A", "选项B", "选项C", "选项D", "选项E"] })
    }
  },
  onInput: function(e) {
    var idx = e.currentTarget.dataset.index
    var val = e.detail.value
    var slots = this.data.slots.slice()
    slots[idx] = val
    this.setData({ slots: slots })
  },
  addSlot: function() {
    var slots = this.data.slots.concat(["新选项"])
    this.setData({ slots: slots })
  },
  deleteSlot: function(e) {
    var idx = e.currentTarget.dataset.index
    if (this.data.slots.length <= 2) return
    var slots = this.data.slots.slice()
    slots.splice(idx, 1)
    this.setData({ slots: slots })
  },
  saveSlots: function() {
    var slots = this.data.slots.filter(function(s) { return s.trim() !== "" })
    if (slots.length < 2) {
      wx.showToast({ title: "至少需要2个", icon: "none" })
      return
    }
    wx.setStorageSync("plinko_slots", slots)
    wx.showToast({ title: "已保存", icon: "success" })
    setTimeout(function() { wx.navigateBack() }, 1000)
  }
})
