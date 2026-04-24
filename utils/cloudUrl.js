// utils/cloudUrl.js
// 通过云函数把 fileID 批量换成临时可访问 URL

const cache = new Map();  // 内存缓存,避免重复请求

async function toTempUrls(fileIds) {
  if (!fileIds || !fileIds.length) return [];

  const needFetch = [];
  const result = new Array(fileIds.length);

  fileIds.forEach((id, i) => {
    if (!id || typeof id !== 'string' || !id.startsWith('cloud://')) {
      // 非 cloud:// 的原样返回(外链/本地路径/空值)
      result[i] = id;
    } else if (cache.has(id)) {
      result[i] = cache.get(id);
    } else {
      needFetch.push({ id, index: i });
    }
  });

  if (needFetch.length === 0) return result;

  try {
    const res = await wx.cloud.callFunction({
      name: 'getFileUrls',
      data: { fileList: needFetch.map(x => x.id) },
    });
    const urls = (res.result && res.result.fileList) || [];
    needFetch.forEach((item, i) => {
      const tempUrl = urls[i] && urls[i].tempFileURL;
      if (tempUrl) {
        cache.set(item.id, tempUrl);
        result[item.index] = tempUrl;
      } else {
        result[item.index] = item.id;  // 失败兜底,至少 UI 不崩
      }
    });
  } catch (err) {
    console.error('getFileUrls 云函数调用失败:', err);
    needFetch.forEach(item => { result[item.index] = item.id; });
  }

  return result;
}

module.exports = { toTempUrls };
