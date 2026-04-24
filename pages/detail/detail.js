// pages/detail/detail.js
const db = wx.cloud.database();
const _ = db.command;

const STATUS_TEXT = {
  current: '校内',
  historical: '历史',
  adoption: '待领养',
  fostering: '寄养/医治',
};

Page({
  data: {
    cat: {},
    statusText: '',
    comments: [],
    inputText: '',
    tempImages: [],
    canSend: false,
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
      wx.setNavigationBarTitle({ title: res.data.name || '猫猫详情' });
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '猫猫信息加载失败', icon: 'none' });
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
      // 并行上传图片到云存储
      const uploads = tempImages.map(path =>
        wx.cloud.uploadFile({
          cloudPath: `comments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
          filePath: path,
        })
      );
      const uploadResults = await Promise.all(uploads);
      const images = uploadResults.map(r => r.fileID);

      // 获取用户信息(可选)
      let userInfo = {};
      try {
        const profile = await wx.getUserProfile({ desc: '用于评论展示' });
        userInfo = profile.userInfo || {};
      } catch (_) { /* 用户拒绝则匿名 */ }

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
      wx.showToast({ title: '发送成功', icon: 'success' });
      this.loadComments();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '发送失败,请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
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
