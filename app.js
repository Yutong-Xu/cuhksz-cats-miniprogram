// app.js
const config = require('./config.js');

App({
  onLaunch() {
    if (!wx.cloud) return;
    wx.cloud.init({ env: config.cloudEnv, traceUser: true });
  },
});
