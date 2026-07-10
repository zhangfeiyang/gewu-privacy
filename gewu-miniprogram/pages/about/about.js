const { SIMS, CATEGORIES, tr, setLanguage, getLanguage } = require('../../utils/sims.js');

const LANG_KEY = 'gw_lang';
const VERSION = '4.0.0';

function applyStoredLanguage() {
  setLanguage(wx.getStorageSync(LANG_KEY) || 'zh');
}

Page({
  data: { total: 0, cats: '', haptic: true, version: VERSION, lang: 'zh', L: {} },

  labels() {
    return {
      appName: tr('格物实验'),
      versionLine: tr('版本') + ' ' + VERSION + ' · ' + SIMS.length + ' ' + tr('个互动实验'),
      haptic: tr('触感反馈'),
      hapticSub: tr('命中 / 碰撞 / 按钮操作时轻微震动'),
      language: tr('语言'),
      languageSub: tr('选择界面和实验文字语言'),
      zh: tr('中文'),
      en: 'English',
      desc1: tr('格物实验是一款原生、离线的互动仿真实验室，覆盖力学、波动与光、电磁、热学、原子、化学与人工智能等领域。取“格物致知”之意，教学理念受 PhET (phet.colorado.edu) 启发。'),
      desc2: tr('直接拖动、按压、连接、投料和手写，实时观察现象与数据；长按首页卡片可收藏；点右上角「···」可把实验分享给朋友。')
    };
  },

  refreshText() {
    wx.setNavigationBarTitle({ title: tr('关于与设置') });
    this.setData({
      total: SIMS.length,
      cats: CATEGORIES.map(c => tr(c) + ' ' + SIMS.filter(s => s.category === c).length).join(' · '),
      haptic: wx.getStorageSync('gw_haptic') !== 0,
      lang: getLanguage(),
      L: this.labels()
    });
  },

  onLoad() {
    applyStoredLanguage();
    this.refreshText();
  },

  onShow() {
    applyStoredLanguage();
    this.refreshText();
  },

  switchLanguage(e) {
    const lang = e.currentTarget.dataset.lang === 'en' ? 'en' : 'zh';
    setLanguage(lang);
    wx.setStorageSync(LANG_KEY, lang);
    this.refreshText();
  },

  toggleHaptic(e) {
    const on = e.detail.value;
    wx.setStorageSync('gw_haptic', on ? 1 : 0);
    this.setData({ haptic: on });
    if (on) { try { wx.vibrateShort({ type: 'light', fail() {} }); } catch (err) {} }
  },
  onShareAppMessage() {
    return { title: tr('格物实验') + ' — ' + SIMS.length + ' ' + tr('个互动仿真实验室'), path: '/pages/index/index' };
  }
});
