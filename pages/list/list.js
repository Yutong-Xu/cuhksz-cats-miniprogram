// pages/list/list.js
const db = wx.cloud.database();
const { toTempUrls } = require('../../utils/cloudUrl.js');

Page({
  data: {
    cats: [],
    status: '',
    loading: true,
  },

  onLoad(options) {
    const status = options.status || 'current';
    const title = decodeURIComponent(options.title || '猫猫列表');
    wx.setNavigationBarTitle({ title });
    this.setData({ status });
  },

  onShow() {
    this.loadCats();
  },

  onPullDownRefresh() {
    this.loadCats().then(() => wx.stopPullDownRefresh());
  },

  async loadCats() {
    this.setData({ loading: true });
    try {
      const res = await db.collection('cats')
        .where({ status: this.data.status })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      // 把每只猫的 photos fileID 转成临时 URL
      const cats = await Promise.all(res.data.map(async cat => ({
        ...cat,
        photos: await toTempUrls(cat.photos || []),
      })));

      this.setData({ cats });
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}`,
    });
  },

  goToCreate() {
    wx.navigateTo({
      url: `/pages/create/create?status=${this.data.status}`,
    });
  },
});
