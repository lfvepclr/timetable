// utils/cloud.js - 云函数调用封装

/**
 * 调用云函数
 * @param {string} name 云函数名
 * @param {object} data 参数
 * @returns {Promise}
 */
function callFn(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data)
        } else if (res.result && res.result.code !== undefined) {
          reject(new Error(res.result.message || '操作失败'))
        } else {
          // 云函数直接返回数据（无 code 包装）
          resolve(res.result)
        }
      },
      fail(err) {
        console.error(`云函数 ${name} 调用失败:`, err)
        reject(err)
      }
    })
  })
}

/**
 * 上传文件到云存储
 * @param {string} filePath 本地文件路径
 * @param {string} cloudPath 云存储路径
 * @returns {Promise<string>} fileID
 */
function uploadFile(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success(res) {
        resolve(res.fileID)
      },
      fail(err) {
        console.error('上传文件失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 批量获取云存储文件临时链接
 * @param {string[]} fileIDs
 * @returns {Promise<string[]>} 临时URL列表
 */
function getTempFileURLs(fileIDs) {
  return new Promise((resolve, reject) => {
    wx.cloud.getTempFileURL({
      fileList: fileIDs,
      success(res) {
        resolve(res.fileList.map(f => f.tempFileURL))
      },
      fail(err) {
        console.error('获取文件链接失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 删除云存储文件
 * @param {string[]} fileIDs
 */
function deleteFiles(fileIDs) {
  return new Promise((resolve, reject) => {
    wx.cloud.deleteFile({
      fileList: fileIDs,
      success(res) {
        resolve(res.fileList)
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = {
  callFn,
  uploadFile,
  getTempFileURLs,
  deleteFiles
}
