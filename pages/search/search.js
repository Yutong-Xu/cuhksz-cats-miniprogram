// pages/search/search.js
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    query: '',
    cats: [],
    searched: false,
    statusLabels: {
      current:   '校内',
      adoption:  '待领养',
      fostering: '寄养/医治',
      adopted:   '已领养',
      missing:   '已失踪',
      deceased:  '已去世',
    },
  },

  onInput(e) {
    this.setData({ query: e.detail.value });
  },

  clearQuery() {
    this.setData({ query: '', cats: [], searched: false });
  },

  async doSearch() {
    const q = this.data.query.trim();
    if (!q) return;

    wx.showLoading({ title: '搜索中' });
    try {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = db.RegExp({ regexp: safe, options: 'i' });

      const res = await db.collection('cats')
        .where(_.or([
          { name: reg },
          { location: reg },
          { personality: reg },
          { description: reg },
        ]))
        .limit(50)
        .get();

      this.setData({ cats: res.data, searched: true });
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  goToDetail(e) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}`,
    });
  },
});
