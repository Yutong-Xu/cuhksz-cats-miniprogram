// pages/index/index.js
Page({
  goToList(e) {
    const { status, title } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/list/list?status=${status}&title=${encodeURIComponent(title)}`,
    });
  },
  goToSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },
});
