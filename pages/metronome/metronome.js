const STORAGE_KEY = 'metronome_settings';
const DEFAULT_SETTINGS = {
  bpm: 90,
  beats: 4,
  soundOn: true,
  vibrateOn: false
};

Page({
  /**
   * 页面的初始数据
   */
  data: {
    bpm: 90,
    beats: 4,
    beatsOptions: [2, 3, 4, 6],
    soundOn: true,
    vibrateOn: false,
    playing: false,
    beatIndex: 0,
    tempoMark: '行板'
  },

  /**
   * 生命周期--页面加载
   */
  onLoad(options) {
    this.loadSettings();
    this.updateTempoMark();
  },

  /**
   * 生命周期--页面隐藏时停止节拍器
   */
  onHide() {
    this.stopPlay();
  },

  /**
   * 生命周期--页面卸载时清理资源
   */
  onUnload() {
    this.stopPlay();
    this.destroyTickPlayers();
  },

  /**
   * 从本地存储加载设置
   */
  loadSettings() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY);
      if (saved) {
        const beatsOptions = this.data.beatsOptions;
        this.setData({
          bpm: this.clampBpm(saved.bpm || DEFAULT_SETTINGS.bpm),
          beats: beatsOptions.indexOf(saved.beats) > -1 ? saved.beats : DEFAULT_SETTINGS.beats,
          soundOn: saved.soundOn !== false,
          vibrateOn: saved.vibrateOn === true
        });
      }
    } catch (e) {
      console.error('加载设置失败:', e);
    }
  },

  /**
   * 保存设置到本地存储
   */
  saveSettings() {
    try {
      wx.setStorageSync(STORAGE_KEY, {
        bpm: this.data.bpm,
        beats: this.data.beats,
        soundOn: this.data.soundOn,
        vibrateOn: this.data.vibrateOn
      });
    } catch (e) {
      console.error('保存设置失败:', e);
    }
  },

  /**
   * 限制BPM在有效范围内
   */
  clampBpm(bpm) {
    return Math.min(240, Math.max(40, Math.round(bpm)));
  },

  /**
   * 更新速度术语
   */
  updateTempoMark() {
    const bpm = this.data.bpm;
    let mark = '庄板';
    if (bpm < 60) {
      mark = '庄板';
    } else if (bpm < 76) {
      mark = '慢板';
    } else if (bpm < 108) {
      mark = '行板';
    } else if (bpm < 120) {
      mark = '小快板';
    } else if (bpm < 156) {
      mark = '快板';
    } else if (bpm < 200) {
      mark = '极快板';
    } else {
      mark = '急板';
    }
    this.setData({ tempoMark: mark });
  },

  /**
   * 减速按钮
   */
  decreaseBpm() {
    this.setBpm(this.data.bpm - 5);
  },

  /**
   * 加速按钮
   */
  increaseBpm() {
    this.setBpm(this.data.bpm + 5);
  },

  /**
   * 滑块拖动结束
   */
  onBpmChange(e) {
    this.setBpm(e.detail.value);
  },

  /**
   * 滑块拖动中
   */
  onBpmChanging(e) {
    this.setData({ bpm: e.detail.value }, () => {
      this.updateTempoMark();
    });
  },

  /**
   * 设置BPM
   */
  setBpm(bpm) {
    this.setData({ bpm: this.clampBpm(bpm) }, () => {
      this.updateTempoMark();
      this.saveSettings();
    });
  },

  /**
   * 切换每小节拍数
   */
  onBeatsChange(e) {
    const beats = parseInt(e.currentTarget.dataset.beats);
    if (this.data.beats === beats) return;

    this.beatIndex = 0;
    this.setData({
      beats: beats,
      beatIndex: 0
    }, () => {
      this.saveSettings();
    });
  },

  /**
   * 切换声音开关
   */
  onSoundChange(e) {
    this.setData({ soundOn: e.detail.value }, () => {
      if (this.data.soundOn && this.data.playing) {
        this.ensureTickPlayers();
      }
      this.saveSettings();
    });
  },

  /**
   * 切换震动开关
   */
  onVibrateChange(e) {
    this.setData({ vibrateOn: e.detail.value }, () => {
      this.saveSettings();
    });
  },

  /**
   * 开始/停止
   */
  togglePlay() {
    if (this.data.playing) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  },

  /**
   * 开始节拍器
   */
  startPlay() {
    if (this.data.soundOn) {
      this.ensureTickPlayers();
    }

    this.playing = true;
    this.beatIndex = 0;
    this.nextBeatTime = Date.now();

    this.setData({
      playing: true
    });

    this.tick();
  },

  /**
   * 停止节拍器
   */
  stopPlay() {
    if (!this.playing) return;

    this.playing = false;
    this.beatIndex = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.setData({
      playing: false,
      beatIndex: 0
    });
  },

  /**
   * 触发一次节拍并调度下一次（基于绝对时间，自动修正漂移）
   * this.beatIndex 为当前正在响的拍子，显示与声音保持同步
   */
  tick() {
    if (!this.playing) return;

    const beatIndex = this.beatIndex;
    const isAccent = beatIndex === 0;

    this.triggerFeedback(isAccent);

    this.setData({
      beatIndex: beatIndex
    });

    this.beatIndex = (beatIndex + 1) % this.data.beats;

    const interval = 60000 / this.data.bpm;
    this.nextBeatTime += interval;

    const delay = Math.max(0, this.nextBeatTime - Date.now());
    this.timer = setTimeout(() => {
      this.tick();
    }, delay);
  },

  /**
   * 触发声音和震动反馈
   */
  triggerFeedback(isAccent) {
    if (this.data.soundOn) {
      this.playTick(isAccent);
    }
    if (this.data.vibrateOn) {
      wx.vibrateShort({ type: 'light' });
    }
  },

  /**
   * 确保音效播放器已创建（InnerAudioContext 真机兼容性好）
   */
  ensureTickPlayers() {
    if (this.tickPlayer) return;

    this.tickPlayer = this.createTickPlayer('/pages/metronome/tick.wav');
    this.accentPlayer = this.createTickPlayer('/pages/metronome/tick-accent.wav');
  },

  /**
   * 创建单个音效播放器
   */
  createTickPlayer(src) {
    const player = wx.createInnerAudioContext();
    player.src = src;
    player.obeyMuteSwitch = false;
    player.onError((err) => {
      console.error('音效播放失败:', err);
    });
    return player;
  },

  /**
   * 销毁音效播放器
   */
  destroyTickPlayers() {
    [this.tickPlayer, this.accentPlayer].forEach((player) => {
      if (player) {
        try {
          player.destroy();
        } catch (e) {
          console.error('销毁播放器失败:', e);
        }
      }
    });
    this.tickPlayer = null;
    this.accentPlayer = null;
  },

  /**
   * 播放一次滴答声（强拍高音，弱拍低音）
   */
  playTick(isAccent) {
    const player = isAccent ? this.accentPlayer : this.tickPlayer;
    if (!player) return;

    try {
      player.stop();
      player.play();
    } catch (e) {
      console.error('播放音效失败:', e);
    }
  },

  /**
   * 返回主页
   */
  backToHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  }
})
