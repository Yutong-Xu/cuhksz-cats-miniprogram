// pages/create/create.js
const db = wx.cloud.database();
const { compressImages } = require('../../utils/compress.js');

Page({
  data: {
    photos: [],       // 本地临时路径
    name: '',
    gender: 'unknown',
    status: 'current',
    location: '',
    neutered: false,
    personality: '',
    description: '',
    submitting: false,

    genderOptions: [
      { value: 'male',    label: '♂ 公' },
      { value: 'female',  label: '♀ 母' },
      { value: 'unknown', label: '? 未知' },
    ],
    statusOptions: [
      { value: 'current',    label: '校内' },
      { value: 'historical', label: '历史' },
      { value: 'adoption',   label: '待领养' },
      { value: 'fostering',  label: '寄养/医治' },
    ],
  },

  onLoad(options) {
    if (options.status) {
      this.setData({ status: options.status });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ gender: e.currentTarget.dataset.value });
  },

  onStatusChange(e) {
    this.setData({ status: e.currentTarget.dataset.value });
  },

  onNeuteredChange(e) {
    this.setData({ neutered: e.detail.value });
  },

  choosePhotos() {
    const remaining = 9 - this.data.photos.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多 9 张', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const newPaths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({
          photos: [...this.data.photos, ...newPaths],
        });
      },
    });
  },

  removePhoto(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({
      photos: this.data.photos.filter((_, i) => i !== idx),
    });
  },

  async submit() {
    const { name, photos } = this.data;
    if (!name.trim()) {
      wx.showToast({ title: '请填写名字', icon: 'none' });
      return;
    }
    if (photos.length === 0) {
      wx.showToast({ title: '至少上传一张照片', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '上传中', mask: true });

    try {
      
      // 先批量压缩,再上传
      const compressedPaths = await compressImages(photos);
      const uploads = compressedPaths.map(path =>
        wx.cloud.uploadFile({
          cloudPath: `cats/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
          filePath: path,
        })
      );
      const results = await Promise.all(uploads);
      const photoIds = results.map(r => r.fileID);

      // 写入数据库
      await db.collection('cats').add({
        data: {
          name: name.trim(),
          gender: this.data.gender,
          status: this.data.status,
          location: this.data.location.trim(),
          neutered: this.data.neutered,
          personality: this.data.personality.trim(),
          description: this.data.description.trim(),
          photos: photoIds,
          createdAt: db.serverDate(),
        },
      });

      wx.hideLoading();
      wx.showToast({ title: '添加成功 🎉', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '添加失败,请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
});
