Page({
  data: {
    // 日期时间选择器
    datetimeValue: '',
    // 日期选择器
    dateValue: '',
    // 时间选择器
    timeValue: '',
    // 普通选择器
    array: ['选项1', '选项2', '选项3', '选项4', '选项5'],
    index: 0,
    // 多列选择器
    multiArray: [
      ['第一列选项1', '第一列选项2', '第一列选项3'],
      ['第二列选项1', '第二列选项2'],
      ['第三列选项1', '第三列选项2', '第三列选项3', '第三列选项4']
    ],
    multiIndex: [0, 0, 0],
    // 修复后的日期时间选择器
    fixedDatetimeValue: '',
    showPicker: false,
    pickerValue: []
  },

  onLoad() {
    // 初始化日期时间
    const now = new Date();
    now.setHours(now.getHours() + 8); // 东八区时间
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const datetimeStr = `${year}-${month}-${day} ${hours}:${minutes}`;
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}:${minutes}`;
    
    this.setData({
      datetimeValue: datetimeStr,
      dateValue: dateStr,
      timeValue: timeStr,
      fixedDatetimeValue: datetimeStr,
      pickerValue: [now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), now.getMinutes()]
    });
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace('T', ' ');
  },

  onDatetimeChange(e) {
    console.log('日期时间选择器变更:', e.detail.value);
    this.setData({
      datetimeValue: e.detail.value
    });
  },

  onDateChange(e) {
    console.log('日期选择器变更:', e.detail.value);
    this.setData({
      dateValue: e.detail.value
    });
  },

  onTimeChange(e) {
    console.log('时间选择器变更:', e.detail.value);
    this.setData({
      timeValue: e.detail.value
    });
  },

  onArrayChange(e) {
    console.log('普通选择器变更:', e.detail.value);
    this.setData({
      index: e.detail.value
    });
  },

  onMultiChange(e) {
    console.log('多列选择器变更:', e.detail.value);
    this.setData({
      multiIndex: e.detail.value
    });
  },

  onMultiColumnChange(e) {
    console.log('多列选择器列变更:', e.detail);
    const data = {
      multiArray: this.data.multiArray,
      multiIndex: this.data.multiIndex
    };
    data.multiIndex[e.detail.column] = e.detail.value;
    this.setData(data);
  },

  showDateTimePicker() {
    this.setData({
      showPicker: true
    });
  },

  hideDateTimePicker() {
    this.setData({
      showPicker: false
    });
  },

  onFixedDatetimeChange(e) {
    const value = e.detail.value;
    const year = value[0];
    const month = String(value[1] + 1).padStart(2, '0');
    const day = String(value[2] + 1).padStart(2, '0');
    const hours = String(value[3]).padStart(2, '0');
    const minutes = String(value[4]).padStart(2, '0');
    
    const datetimeStr = `${year}-${month}-${day} ${hours}:${minutes}`;
    
    this.setData({
      fixedDatetimeValue: datetimeStr,
      showPicker: false
    });
    
    console.log('修复后的日期时间选择器变更:', datetimeStr);
  }
})
