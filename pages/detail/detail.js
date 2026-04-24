// pages/detail/detail.js
const db = wx.cloud.database();

const STATUS_TEXT = {
  current: '校内',
  historical: '历史',
  adoption: '待领养',
  fostering: '寄养/医治',
};

// 每个字段的编辑配置
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

    // 编辑弹窗状态
    editing: {
      visible: false,
      field: '',
      label: '',
      type: '',
      placeholder: '',
      options: [],
      value: '',
    },
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

  // ========== 编辑弹窗 ==========
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

    // 文本字段校验
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
      } catch (_) { /* 拒绝则匿名 */ }

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
