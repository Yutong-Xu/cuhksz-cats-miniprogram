// utils/compress.js
// 大图上传前压缩,省云存储额度 + 加快上传速度

const SKIP_IF_SMALLER_THAN = 500 * 1024;  // 500KB 以下不压
const QUALITY = 70;                        // JPG 压缩质量 0-100
const MAX_DIMENSION = 1600;                // 最长边像素上限

/**
 * 压缩单张图片
 * @param {string} filePath - 本地临时路径(chooseMedia 的 tempFilePath)
 * @returns {Promise<string>} - 压缩后的临时路径,或失败时的原路径
 */
async function compressImage(filePath) {
  try {
    // 1. 读文件大小,小图直接跳过
    const fileInfo = await new Promise((resolve, reject) => {
      wx.getFileInfo({ filePath, success: resolve, fail: reject });
    });
    if (fileInfo.size < SKIP_IF_SMALLER_THAN) {
      return filePath;
    }

    // 2. 读图片尺寸,计算按比例缩放后的目标尺寸
    const imgInfo = await new Promise((resolve, reject) => {
      wx.getImageInfo({ src: filePath, success: resolve, fail: reject });
    });
    let targetW = imgInfo.width;
    let targetH = imgInfo.height;
    const longestSide = Math.max(targetW, targetH);
    if (longestSide > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / longestSide;
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    // 3. 执行压缩
    const res = await new Promise((resolve, reject) => {
      wx.compressImage({
        src: filePath,
        quality: QUALITY,
        compressedWidth: targetW,
        compressedHeight: targetH,
        success: resolve,
        fail: reject,
      });
    });
    return res.tempFilePath;
  } catch (err) {
    // 压缩失败不阻塞业务,降级用原图
    console.warn('[compress] 压缩失败,用原图:', err);
    return filePath;
  }
}

/** 批量压缩 */
async function compressImages(filePaths) {
  return Promise.all(filePaths.map(compressImage));
}

module.exports = { compressImage, compressImages };
