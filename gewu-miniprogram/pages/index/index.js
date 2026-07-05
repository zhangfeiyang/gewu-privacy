const { SIMS, CATEGORIES } = require('../../utils/sims.js');

// 用标准 rgba() 而非 8 位 hex alpha（部分安卓 WebView 对 8 位 hex 支持不稳定）。
function toRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

const FAV_KEY = 'gw_fav';
const RECENT_KEY = 'gw_recent';
const VISITED_KEY = 'gw_visited';

Page({
  data: { groups: [], keyword: '', total: 0, empty: false, progress: 0, visitedCount: 0, favs: [], recent: [], catChips: [], jumpId: '' },

  jumpCat(e) {
    const id = e.currentTarget.dataset.id;
    // 先清空再设置，保证重复点击同一分类也能触发滚动
    this.setData({ jumpId: '' });
    setTimeout(() => this.setData({ jumpId: id }), 50);
  },

  onLoad() {
    this.metaById = {};
    this.all = SIMS.map(s => {
      const m = { id: s.id, title: s.title, sub: s.sub, emoji: s.emoji, color: s.color, bg: toRgba(s.color, 0.14), category: s.category };
      this.metaById[s.id] = m;
      return m;
    });
    this.setData({
      total: SIMS.length,
      catChips: CATEGORIES.map(c => ({ name: c, count: SIMS.filter(s => s.category === c).length })).filter(c => c.count > 0)
    });
    this.refresh('');
  },

  // 从别的页面返回时重新读取收藏/最近/进度
  onShow() { this.refresh(this.data.keyword); },

  refresh(kw) {
    const fav = wx.getStorageSync(FAV_KEY) || [];
    const recentIds = wx.getStorageSync(RECENT_KEY) || [];
    const visited = wx.getStorageSync(VISITED_KEY) || [];
    const favSet = {};
    fav.forEach(id => { favSet[id] = true; });
    this.all.forEach(s => { s.fav = !!favSet[s.id]; });

    const k = (kw || '').trim();
    const kl = k.toLowerCase();
    const match = s => !k || s.title.indexOf(k) >= 0 || s.category.indexOf(k) >= 0 || s.sub.toLowerCase().indexOf(kl) >= 0;
    const groups = CATEGORIES.map((cat, ci) => ({
      name: cat,
      aid: 'cat' + ci,   // 锚点用 CATEGORIES 固定序号，搜索过滤后跳转依然正确
      items: this.all.filter(s => s.category === cat && match(s))
    })).filter(g => g.items.length > 0);

    this.setData({
      groups,
      empty: groups.length === 0,
      favs: fav.map(id => this.metaById[id]).filter(Boolean),
      recent: recentIds.map(id => this.metaById[id]).filter(Boolean).slice(0, 8),
      visitedCount: visited.length,
      progress: Math.round(visited.length / this.data.total * 100)
    });
  },

  onSearch(e) { this.setData({ keyword: e.detail.value }); this.refresh(e.detail.value); },
  clearSearch() { this.setData({ keyword: '' }); this.refresh(''); },

  record(id) {
    let recent = wx.getStorageSync(RECENT_KEY) || [];
    recent = recent.filter(x => x !== id); recent.unshift(id); recent = recent.slice(0, 12);
    wx.setStorageSync(RECENT_KEY, recent);
    let visited = wx.getStorageSync(VISITED_KEY) || [];
    if (visited.indexOf(id) < 0) { visited.push(id); wx.setStorageSync(VISITED_KEY, visited); }
  },

  openSim(e) { this.go(e.currentTarget.dataset.id); },
  go(id) { this.record(id); wx.navigateTo({ url: '/pages/sim/sim?id=' + id }); },

  randomSim() {
    const s = this.all[Math.floor(Math.random() * this.all.length)];
    try { wx.vibrateShort({ type: 'light', fail() {} }); } catch (err) {}
    wx.showToast({ title: '随机探索：' + s.title, icon: 'none', duration: 1200 });
    this.go(s.id);
  },

  toggleFav(e) {
    const id = e.currentTarget.dataset.id;
    let fav = wx.getStorageSync(FAV_KEY) || [];
    const i = fav.indexOf(id);
    if (i >= 0) { fav.splice(i, 1); wx.showToast({ title: '已取消收藏', icon: 'none' }); }
    else { fav.push(id); wx.showToast({ title: '已收藏 ⭐', icon: 'none' }); try { wx.vibrateShort({ type: 'light', fail() {} }); } catch (err) {} }
    wx.setStorageSync(FAV_KEY, fav);
    this.refresh(this.data.keyword);
  },

  openAbout() { wx.navigateTo({ url: '/pages/about/about' }); },

  onShareAppMessage() {
    return { title: '格物实验 — ' + SIMS.length + ' 个互动物理化学仿真实验室', path: '/pages/index/index' };
  }
});
