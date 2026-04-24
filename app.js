// app.js
const config = require('./config.js');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库');
      return;
    }
    wx.cloud.init({
      env: config.cloudEnv,
      traceUser: true,
    });
  },
});