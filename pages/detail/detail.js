// pages/detail/detail.js
const db = wx.cloud.database();
const { compressImages } = require('../../utils/compress.js');

const STATUS_TEXT = {
  current: '校内',
  historical: '历史',
  adoption: '待领养',
  fostering: '寄养/医治',
};

const FIELD_CONFIG = {
  name:        { label: '名字',     type: 'text',     placeholder: '给它起个名字' },
  gender:      { label: '性别',     type: 'radio',    options: [
    { value: 'male', label: '♂ 公' },
    { value: 'female', label: '♀ 母' },
    { value: 'unknown', label: '? 未知' },
  ]},
  neutered:    { label: '绝育状态', type: 'radio',    options: [
    { value: true,  label: '✓ 已绝育' },
    { value: false, label: '✗ 未绝育' },
  ]},
  location:    { label: '位置',     type: 'text',     placeholder: '例:下园食堂附近' },
  status:      { label: '类别',     type: 'radio',    options: [
    { value: 'current',    label: '校内' },
    { value: 'historical', label: '历史' },
    { value: 'adoption',   label: '待领养' },
    { value: 'fostering',  label: '寄养/医治' },
  ]},
  personality: { label: '性格',     type: 'textarea', placeholder: '描述一下它的性格...' },
  description: { label: '故事',     type: 'textarea', placeholder: '它的故事...' },
};

Page({
  data: {
    cat: {},
    statusText: '',

    // 字段编辑弹窗
    editing: {
      visible: false, field: '', label: '', type: '',
      placeholder: '', options: [], value: '',
    },

    // 照片管理弹窗
    photoManager: {
      visible: false,
      items: [],  // { key, url, isNew, pendingDelete, localPath? }
    },
    remainingSlots: 9,
  },

  onLoad(options) {
    this.catId = options.id;
    this.loadCat();
  },

  onPullDownRefresh() {
    this.loadCat().finally(() => wx.stopPullDownRefresh());
  },

  async loadCat() {
    try {
      const res = await db.collection('cats').doc(this.catId).get();
      this.setData({
        cat: res.data,
        statusText: STATUS_TEXT[res.data.status] || '',
      });
      wx.setNavigationBarTitle({ title: res.data.name || '猫咪详情' });
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ========== 字段编辑 ==========
  editField(e) {
    const field = e.currentTarget.dataset.field;
    const config = FIELD_CONFIG[field];
    if (!config) return;

    this.setData({
      editing: {
        visible: true,
        field,
        label: config.label,
        type: config.type,
        placeholder: config.placeholder || '',
        options: config.options || [],
        value: this.data.cat[field] !== undefined ? this.data.cat[field] : '',
      },
    });
  },

  onEditInput(e) {
    this.setData({ 'editing.value': e.detail.value });
  },

  onEditPick(e) {
    this.setData({ 'editing.value': e.currentTarget.dataset.value });
  },

  closeEdit() {
    this.setData({ 'editing.visible': false });
  },

  async saveEdit() {
    const { field, value, type } = this.data.editing;

    if (type === 'text' && typeof value === 'string' && !value.trim()) {
      wx.showToast({ title: '不能为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中', mask: true });
    try {
      const newValue = typeof value === 'string' ? value.trim() : value;
      await db.collection('cats').doc(this.catId).update({
        data: { [field]: newValue },
      });
      this.setData({
        [`cat.${field}`]: newValue,
        statusText: field === 'status' ? STATUS_TEXT[newValue] : this.data.statusText,
        'editing.visible': false,
      });
      if (field === 'name') {
        wx.setNavigationBarTitle({ title: newValue });
      }
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // ========== 照片管理 ==========
  openPhotoManager() {
    const items = (this.data.cat.photos || []).map((url, i) => ({
      key: `existing_${i}`,
      url,
      isNew: false,
      pendingDelete: false,
    }));
    this.setData({
      'photoManager.visible': true,
      'photoManager.items': items,
      remainingSlots: 9 - items.filter(x => !x.pendingDelete).length,
    });
  },

  closePhotoManager() {
    this.setData({ 'photoManager.visible': false });
  },

  togglePhotoDelete(e) {
    const key = e.currentTarget.dataset.key;
    const items = this.data.photoManager.items.map(item => {
      if (item.key !== key) return item;
      if (item.isNew) return null;
      return { ...item, pendingDelete: !item.pendingDelete };
    }).filter(Boolean);

    this.setData({
      'photoManager.items': items,
      remainingSlots: 9 - items.filter(x => !x.pendingDelete).length,
    });
  },

  addPhotosInManager() {
    const remaining = this.data.remainingSlots;
    if (remaining <= 0) return;
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const newItems = res.tempFiles.map((f, i) => ({
          key: `new_${Date.now()}_${i}`,
          url: f.tempFilePath,
          localPath: f.tempFilePath,
          isNew: true,
          pendingDelete: false,
        }));
        const items = [...this.data.photoManager.items, ...newItems];
        this.setData({
          'photoManager.items': items,
          remainingSlots: 9 - items.filter(x => !x.pendingDelete).length,
        });
      },
    });
  },

  async savePhotoChanges() {
    const items = this.data.photoManager.items;
    const toDelete = items.filter(x => !x.isNew && x.pendingDelete).map(x => x.url);
    const toUpload = items.filter(x => x.isNew);
    const kept = items.filter(x => !x.isNew && !x.pendingDelete).map(x => x.url);

    if (kept.length + toUpload.length === 0) {
      wx.showToast({ title: '至少保留一张照片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中', mask: true });
    try {
      // 1. 压缩 + 上传新照片
      let uploadedIds = [];
      if (toUpload.length) {
        const compressedPaths = await compressImages(toUpload.map(i => i.localPath));
        const results = await Promise.all(compressedPaths.map(path =>
          wx.cloud.uploadFile({
            cloudPath: `cats/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
            filePath: path,
          })
        ));
        uploadedIds = results.map(r => r.fileID);
      }

      // 2. 更新数据库
      const newPhotos = [...kept, ...uploadedIds];
      await db.collection('cats').doc(this.catId).update({
        data: { photos: newPhotos },
      });

      // 3. 清理云存储(失败不阻塞)
      if (toDelete.length) {
        wx.cloud.deleteFile({ fileList: toDelete }).catch(err => {
          console.warn('云存储删除失败:', err);
        });
      }

      this.setData({
        'cat.photos': newPhotos,
        'photoManager.visible': false,
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // ========== 删除猫咪 ==========
  deleteCat() {
    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${this.data.cat.name}」吗?此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#E53935',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          await this.doDeleteCat();
        }
      },
    });
  },

  async doDeleteCat() {
    wx.showLoading({ title: '删除中', mask: true });
    try {
      const cloudFiles = (this.data.cat.photos || []).filter(
        f => typeof f === 'string' && f.startsWith('cloud://')
      );

      // 1. 删猫咪记录
      await db.collection('cats').doc(this.catId).remove();

      // 2. 清理云存储(失败不阻塞)
      if (cloudFiles.length) {
        wx.cloud.deleteFile({ fileList: cloudFiles }).catch(err => {
          console.warn('云存储清理失败:', err);
        });
      }

      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  // ========== 照片预览 ==========
  previewPhoto(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ current: url, urls: this.data.cat.photos || [url] });
  },
});
