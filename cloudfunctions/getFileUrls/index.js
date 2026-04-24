// cloudfunctions/getFileUrls/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { fileList = [] } = event;
  if (!fileList.length) return { fileList: [] };

  try {
    const res = await cloud.getTempFileURL({ fileList });
    return { fileList: res.fileList };
  } catch (err) {
    console.error('getTempFileURL error:', err);
    return { fileList: [], error: err.message };
  }
};
