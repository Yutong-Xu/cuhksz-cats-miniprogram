// pages/list/list.js
const db = wx.cloud.database();

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
    // 每次回到这个页面都刷新(从录入页返回后能立即看到新数据)
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
      this.setData({ cats: res.data });
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
    // 带上当前类别,录入页会预选
    wx.navigateTo({
      url: `/pages/create/create?status=${this.data.status}`,
    });
  },
});
