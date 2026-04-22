Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 表单数据
    selectedProjectIndex: -1,  // 初始为-1，表示未选择
    selectedProject: null,
    selectedDate: '',
    duration: '',
    remark: '',
    
    // 新项目输入
    newProjectName: '',
    
    // 数据列表 - 移除默认项目
    projectList: [],  // 初始为空数组
    records: [],
    recentRecords: [],
    totalRecords: 0,
    
    // 其他
    today: '',
    canSubmit: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化当前日期
    const today = this.getTodayDate();
    
    // 从本地存储加载数据
    this.loadData();
    
    // 设置默认数据
    this.setData({
      today: today,
      selectedDate: today,
      // 如果项目列表为空，selectedProject保持为null
    });
    
    this.checkCanSubmit();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadData();
  },

  /**
   * 获取今天的日期 YYYY-MM-DD
   */
  getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 从本地存储加载数据
   */
  loadData() {
    try {
      // 加载项目列表
      const savedProjects = wx.getStorageSync('record_projects');
      if (savedProjects) {
        this.setData({
          projectList: savedProjects
        });
      }

      // 加载记录列表
      const savedRecords = wx.getStorageSync('record_records');
      if (savedRecords) {
        this.setData({
          records: savedRecords
        });
        this.updateRecentRecords();
        this.updateProjectRecordCounts();
      }
    } catch (e) {
      console.error('加载数据失败:', e);
    }
  },

  /**
   * 保存数据到本地存储
   */
  saveData() {
    try {
      wx.setStorageSync('record_projects', this.data.projectList);
      wx.setStorageSync('record_records', this.data.records);
    } catch (e) {
      console.error('保存数据失败:', e);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 更新最近记录显示
   */
  updateRecentRecords() {
    const recent = [...this.data.records]
      .sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
      .slice(0, 5);
    
    this.setData({
      recentRecords: recent,
      totalRecords: this.data.records.length
    });
  },

  /**
   * 更新项目的记录数量
   */
  updateProjectRecordCounts() {
    const projects = [...this.data.projectList];
    
    projects.forEach(project => {
      project.recordCount = this.data.records.filter(
        record => record.projectId === project.id
      ).length;
    });
    
    this.setData({
      projectList: projects
    });
  },

  /**
   * 检查是否可以提交表单
   */
  checkCanSubmit() {
    const canSubmit = this.data.selectedProject && 
                     this.data.selectedDate && 
                     this.data.duration && 
                     parseInt(this.data.duration) > 0;
    
    this.setData({ canSubmit });
  },

  /**
   * 项目选择器变化
   */
  onProjectChange(e) {
    const index = e.detail.value;
    const project = this.data.projectList[index];
    
    this.setData({
      selectedProjectIndex: index,
      selectedProject: project
    }, () => {
      this.checkCanSubmit();
    });
  },

  /**
   * 日期选择器变化
   */
  onDateChange(e) {
    this.setData({
      selectedDate: e.detail.value
    }, () => {
      this.checkCanSubmit();
    });
  },

  /**
   * 时长输入变化
   */
  onDurationInput(e) {
    this.setData({
      duration: e.detail.value
    }, () => {
      this.checkCanSubmit();
    });
  },

  /**
   * 备注输入变化
   */
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  /**
   * 新项目名称输入变化
   */
  onNewProjectInput(e) {
    this.setData({
      newProjectName: e.detail.value.trim()
    });
  },

  /**
   * 提交记录
   */
  submitRecord() {
    if (!this.data.canSubmit) return;

    const durationNum = parseInt(this.data.duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      wx.showToast({
        title: '请输入有效的时长',
        icon: 'none'
      });
      return;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newRecord = {
      id: Date.now(),
      projectId: this.data.selectedProject.id,
      projectName: this.data.selectedProject.name,
      date: this.data.selectedDate,
      duration: durationNum,
      remark: this.data.remark,
      createTime: `${this.data.selectedDate} ${timeStr}`
    };

    // 添加到记录列表
    const records = [...this.data.records, newRecord];
    
    this.setData({
      records: records,
      duration: '',
      remark: ''
    }, () => {
      this.updateRecentRecords();
      this.updateProjectRecordCounts();
      this.saveData();
      this.checkCanSubmit();
      
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
    });
  },

  /**
   * 删除记录
   */
  deleteRecord(e) {
    const index = e.currentTarget.dataset.index;
    const recordId = this.data.recentRecords[index].id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          const records = this.data.records.filter(r => r.id !== recordId);
          
          this.setData({
            records: records
          }, () => {
            this.updateRecentRecords();
            this.updateProjectRecordCounts();
            this.saveData();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
          });
        }
      }
    });
  },

  /**
   * 添加新项目
   */
  addProject() {
    const name = this.data.newProjectName.trim();
    if (!name) {
      wx.showToast({
        title: '请输入项目名称',
        icon: 'none'
      });
      return;
    }

    // 检查是否已存在
    const exists = this.data.projectList.some(project => 
      project.name === name
    );
    
    if (exists) {
      wx.showToast({
        title: '项目已存在',
        icon: 'none'
      });
      return;
    }

    // 生成新项目ID
    const newId = this.data.projectList.length > 0 
      ? Math.max(...this.data.projectList.map(p => p.id)) + 1 
      : 1;

    const newProject = {
      id: newId,
      name: name,
      recordCount: 0
    };

    const projects = [...this.data.projectList, newProject];
    
    // 如果是第一个项目，自动选中它
    const selectedIndex = projects.length - 1;
    
    this.setData({
      projectList: projects,
      newProjectName: '',
      selectedProjectIndex: selectedIndex,
      selectedProject: newProject
    }, () => {
      this.saveData();
      this.checkCanSubmit();
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
    });
  },
  /**
   * 编辑项目
   */
  editProject(e) {
    const index = e.currentTarget.dataset.index;
    const project = this.data.projectList[index];
    
    wx.showModal({
      title: '编辑项目',
      content: '请输入新的项目名称',
      editable: true,
      placeholderText: project.name,
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          const newName = res.content.trim();
          
          // 检查是否重复
          const exists = this.data.projectList.some((p, i) => 
            i !== index && p.name === newName
          );
          
          if (exists) {
            wx.showToast({
              title: '项目名已存在',
              icon: 'none'
            });
            return;
          }

          const projects = [...this.data.projectList];
          projects[index].name = newName;
          
          this.setData({
            projectList: projects
          }, () => {
            this.saveData();
            wx.showToast({
              title: '修改成功',
              icon: 'success'
            });
          });
        }
      }
    });
  },
 /**
   * 删除项目
   */
  deleteProject(e) {
    const index = e.currentTarget.dataset.index;
    const project = this.data.projectList[index];
    
    if (project.recordCount > 0) {
      wx.showToast({
        title: '该项目已有记录，无法删除',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除项目"${project.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          const projects = this.data.projectList.filter((_, i) => i !== index);
          
          // 更新选中的项目
          let newIndex = -1;
          let newProject = null;
          
          if (projects.length > 0) {
            // 如果有其他项目，选择第一个
            newIndex = 0;
            newProject = projects[0];
          }
          
          this.setData({
            projectList: projects,
            selectedProjectIndex: newIndex,
            selectedProject: newProject
          }, () => {
            this.saveData();
            this.checkCanSubmit();
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
          });
        }
      }
    });
  },

  /**
   * 检查是否可以提交表单
   */
  checkCanSubmit() {
    const canSubmit = this.data.selectedProject && 
                     this.data.selectedDate && 
                     this.data.duration && 
                     parseInt(this.data.duration) > 0;
    
    this.setData({ canSubmit });
  },

  /**
   * 返回主页
   */
  backToHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  }
});