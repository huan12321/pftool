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
    this.destroyAudioContext();
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
        this.ensureAudioContext();
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
      this.ensureAudioContext();
    }

    this.playing = true;
    this.nextBeatTime = Date.now();

    this.setData({
      playing: true,
      beatIndex: 0
    });

    this.tick();
  },

  /**
   * 停止节拍器
   */
  stopPlay() {
    if (!this.playing) return;

    this.playing = false;
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
   */
  tick() {
    if (!this.playing) return;

    const beatIndex = this.data.beatIndex;
    const isAccent = beatIndex === 0;

    this.triggerFeedback(isAccent);

    const interval = 60000 / this.data.bpm;
    this.nextBeatTime += interval;

    this.setData({
      beatIndex: (beatIndex + 1) % this.data.beats
    });

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
   * 确保 Web Audio 上下文可用
   */
  ensureAudioContext() {
    if (this.audioCtx) return;

    try {
      this.audioCtx = wx.createWebAudioContext();
    } catch (e) {
      console.error('创建音频上下文失败:', e);
      this.audioCtx = null;
    }
  },

  /**
   * 销毁音频上下文
   */
  destroyAudioContext() {
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {
        console.error('关闭音频上下文失败:', e);
      }
      this.audioCtx = null;
    }
  },

  /**
   * 播放一次滴答声（强拍高音，弱拍低音）
   */
  playTick(isAccent) {
    if (!this.audioCtx) return;

    try {
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1600 : 1000, now);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
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
