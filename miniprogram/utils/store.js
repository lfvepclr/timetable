// utils/store.js - 轻量状态管理

const _state = {}
const _listeners = {}

/**
 * 设置状态
 * @param {string} key
 * @param {*} value
 */
function setState(key, value) {
  _state[key] = value
  if (_listeners[key]) {
    _listeners[key].forEach(cb => cb(value))
  }
}

/**
 * 获取状态
 * @param {string} key
 * @param {*} defaultValue
 */
function getState(key, defaultValue) {
  return _state[key] !== undefined ? _state[key] : defaultValue
}

/**
 * 订阅状态变化
 * @param {string} key
 * @param {function} callback
 * @returns {function} 取消订阅函数
 */
function subscribe(key, callback) {
  if (!_listeners[key]) {
    _listeners[key] = []
  }
  _listeners[key].push(callback)
  return () => {
    const idx = _listeners[key].indexOf(callback)
    if (idx > -1) {
      _listeners[key].splice(idx, 1)
    }
  }
}

/**
 * 清除所有状态
 */
function clear() {
  Object.keys(_state).forEach(k => delete _state[k])
  Object.keys(_listeners).forEach(k => delete _listeners[k])
}

module.exports = {
  setState,
  getState,
  subscribe,
  clear
}
