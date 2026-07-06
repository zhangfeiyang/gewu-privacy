const { SIMS, CATEGORIES } = require('../../utils/sims.js');

Page({
  data: { total: 0, cats: '', haptic: true, version: '3.8.1' },
  onLoad() {
    this.setData({
      total: SIMS.length,
      cats: CATEGORIES.map(c => c + ' ' + SIMS.filter(s => s.category === c).length).join(' · '),
      haptic: wx.getStorageSync('gw_haptic') !== 0
    });
  },
  toggleHaptic(e) {
    const on = e.detail.value;
    wx.setStorageSync('gw_haptic', on ? 1 : 0);
    this.setData({ haptic: on });
    if (on) { try { wx.vibrateShort({ type: 'light', fail() {} }); } catch (err) {} }
  },
  onShareAppMessage() {
    return { title: '格物实验 — ' + SIMS.length + ' 个互动仿真实验室', path: '/pages/index/index' };
  }
});
