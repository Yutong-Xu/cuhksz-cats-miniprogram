// pages/detail/detail.js
const db = wx.cloud.database();
const _ = db.command;

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
    comments: [],
    inputText: '',
    tempImages: [],
    canSend: false,

    editing: {
      visible: false, field: '', label: '', type: '',
      placeholder: '', options: [], value: '',
    },

    // 照片管理
    photoManager: {
      visible: false,
      items: [],  // { key, url, isNew, pendingDelete, localPath? }
    },
    remainingSlots: 9,
  },

  onLoad(options) {
    this.catId = options.id;
    this.loadCat();
    this.loadComments();
  },

  onPullDownRefresh() {
    Promise.all([this.loadCat(), this.loadComments()])
      .finally(() => wx.stopPullDownRefresh());
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

  async loadComments() {
    try {
      const res = await db.collection('comments')
        .where({ catId: this.catId })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      const comments = res.data.map(c => ({
        ...c,
        images: c.images || [],
        timeText: formatTime(c.createdAt),
      }));
      this.setData({ comments });
    } catch (err) {
      console.error(err);
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
      url,                  // 云存储 fileID 或 URL
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
      // 新添加的照片 → 直接移除
      if (item.isNew) return null;
      // 已存在的照片 → 切换 pendingDelete 标记
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
      // 1. 上传新照片
      let uploadedIds = [];
      if (toUpload.length) {
        const results = await Promise.all(toUpload.map(item =>
          wx.cloud.uploadFile({
            cloudPath: `cats/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
            filePath: item.localPath,
          })
        ));
        uploadedIds = results.map(r => r.fileID);
      }

      // 2. 更新数据库(先更数据库,确保云存储删除失败时数据状态一致)
      const newPhotos = [...kept, ...uploadedIds];
      await db.collection('cats').doc(this.catId).update({
        data: { photos: newPhotos },
      });

      // 3. 从云存储删除被移除的照片(失败不阻塞)
      if (toDelete.length) {
        wx.cloud.deleteFile({ fileList: toDelete }).catch(err => {
          console.warn('云存储删除失败(不影响功能):', err);
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
      content: `确定要删除「${this.data.cat.name}」吗?此操作不可恢复,评论和照片会一并删除。`,
      confirmText: '删除',
      confirmColor: '#E53935',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        await this.doDeleteCat();
      },
    });
  },

  async doDeleteCat() {
    wx.showLoading({ title: '删除中', mask: true });
    try {
      // 收集所有要删除的云存储文件
      const filesToDelete = [...(this.data.cat.photos || [])];
      this.data.comments.forEach(c => {
        if (c.images && c.images.length) filesToDelete.push(...c.images);
      });
      // 只保留 cloud:// 开头的(兼容外链 URL)
      const cloudFiles = filesToDelete.filter(f => typeof f === 'string' && f.startsWith('cloud://'));

      // 1. 删除评论
      if (this.data.comments.length) {
        // 客户端的 remove 受权限限制,需要一条条删。如果量大应该用云函数。
        // 这里直接批量 remove 按 catId 过滤
        await db.collection('comments').where({ catId: this.catId }).remove().catch(err => {
          console.warn('批量删除评论失败,可能无权限。错误:', err);
        });
      }

      // 2. 删除猫咪记录
      await db.collection('cats').doc(this.catId).remove();

      // 3. 删除云存储文件(失败不阻塞)
      if (cloudFiles.length) {
        wx.cloud.deleteFile({ fileList: cloudFiles }).catch(err => {
          console.warn('云存储清理失败(不影响功能):', err);
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

  // ========== 评论 ==========
  onInput(e) {
    const text = e.detail.value;
    this.setData({
      inputText: text,
      canSend: !!text.trim() || this.data.tempImages.length > 0,
    });
  },

  chooseImage() {
    const remaining = 9 - this.data.tempImages.length;
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
          tempImages: [...this.data.tempImages, ...newPaths],
          canSend: true,
        });
      },
    });
  },

  removeTempImg(e) {
    const idx = e.currentTarget.dataset.index;
    const tempImages = this.data.tempImages.filter((_, i) => i !== idx);
    this.setData({
      tempImages,
      canSend: !!this.data.inputText.trim() || tempImages.length > 0,
    });
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ current: url, urls: this.data.cat.photos || [url] });
  },

  previewCommentImg(e) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({ current: url, urls });
  },

  async submitComment() {
    const content = this.data.inputText.trim();
    const { tempImages } = this.data;
    if (!content && tempImages.length === 0) return;

    wx.showLoading({ title: '发送中', mask: true });
    try {
      const uploads = tempImages.map(path =>
        wx.cloud.uploadFile({
          cloudPath: `comments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
          filePath: path,
        })

      
      );
      const uploadResults = await Promise.all(uploads);
      const images = uploadResults.map(r => r.fileID);

      let userInfo = {};
      try {
        const profile = await wx.getUserProfile({ desc: '用于评论展示' });
        userInfo = profile.userInfo || {};
      } catch (_) {}

      await db.collection('comments').add({
        data: {
          catId: this.catId,
          content,
          images,
          nickname: userInfo.nickName || '',
          avatar: userInfo.avatarUrl || '',
          createdAt: db.serverDate(),
        },
      });

      this.setData({ inputText: '', tempImages: [], canSend: false });
      wx.hideLoading();
      wx.showToast({ title: '发送成功', icon: 'success' });
      this.loadComments();
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  // ========== 删除评论 ==========
  onCommentLongPress(e) {
    const comment = e.currentTarget.dataset.comment;
    wx.showActionSheet({
      itemList: ['删除评论'],
      itemColor: '#E53935',
      success: async (res) => {
        if (res.tapIndex === 0) {
          await this.deleteComment(comment);
        }
      },
    });
  },

  async deleteComment(comment) {
    wx.showLoading({ title: '删除中', mask: true });
    try {
      // 1. 删数据库记录
      await db.collection('comments').doc(comment._id).remove();

      // 2. 清理云存储里的图片(失败不阻塞)
      const cloudImages = (comment.images || []).filter(
        f => typeof f === 'string' && f.startsWith('cloud://')
      );
      if (cloudImages.length) {
        wx.cloud.deleteFile({ fileList: cloudImages }).catch(err => {
          console.warn('云存储清理失败:', err);
        });
      }

      // 3. 本地移除
      this.setData({
        comments: this.data.comments.filter(c => c._id !== comment._id),
      });
      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },
});



function formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
}
function pad(n) { return n < 10 ? '0' + n : '' + n; }
