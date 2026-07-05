const { getSim } = require('../../utils/sims.js');

Page({
  data: { title: '', controls: [], actions: [], steppers: [] },

  onLoad(q) {
    const sim = getSim(q.id);
    if (!sim) { wx.showToast({ title: '未找到仿真', icon: 'none' }); return; }
    this.sim = sim;
    this.state = sim.init();
    this._buzz = this.state.buzz | 0;
    this.pv = {};
    const controls = sim.params.map(p => {
      this.pv[p.key] = p.value;
      return { key: p.key, label: p.label, min: p.min, max: p.max, step: p.step, value: p.value, display: p.fmt(p.value) };
    });
    this.setData({ title: sim.title, controls, actions: this.labels(), steppers: this.stepperData() });
    wx.setNavigationBarTitle({ title: sim.title });
    // 首次进入任意仿真时给一次轻量操作引导
    if (!wx.getStorageSync('gw_hinted')) {
      wx.setStorageSync('gw_hinted', 1);
      wx.showToast({ title: '拖动下方滑块，观察现象变化', icon: 'none', duration: 2600 });
    }
  },

  haptic() {
    if (wx.getStorageSync('gw_haptic') === 0) return;   // 关于页可关闭触感
    try { wx.vibrateShort({ type: 'light', fail() {} }); } catch (e) {}
  },

  // 分享当前实验给好友/群
  onShareAppMessage() {
    const t = this.sim ? this.sim.title : '格物实验';
    const id = this.sim ? this.sim.id : '';
    return { title: '格物实验 · ' + t + ' — 一起动手做实验', path: '/pages/sim/sim?id=' + id };
  },

  labels() {
    return this.sim.actions.map(a => ({
      label: typeof a.label === 'function' ? a.label(this.state) : a.label,
      primary: !!a.primary
    }));
  },

  stepperData() {
    return (this.sim.steppers || []).map(st => ({
      key: st.key, label: st.label, color: st.color, value: st.get(this.state)
    }));
  },

  onReady() {
    const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
    wx.createSelectorQuery().in(this).select('#cv')
      .fields({ node: true, size: true }).exec(res => {
        if (!res[0]) return;
        const canvas = res[0].node, w = res[0].width, h = res[0].height;
        const ctx = canvas.getContext('2d');
        canvas.width = w * dpr; canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this.canvas = canvas; this.ctx = ctx; this.cw = w; this.ch = h;
        this.last = 0;
        // 静态仿真只在交互时重绘；动画仿真跑持续循环。
        this.render();
        if (this.sim && !this.sim.static) this.start();
      });
  },

  // 单帧渲染（供静态仿真在交互后调用）
  render() {
    if (!this.sim || !this.ctx) return;
    this.sim.step(this.state, this.pv, 0);
    this.ctx.clearRect(0, 0, this.cw, this.ch);
    this.sim.draw(this.ctx, this.cw, this.ch, this.state, this.pv);
  },

  // 静态仿真交互后主动重绘一帧
  redrawIfStatic() {
    if (this.sim && this.sim.static) this.render();
  },

  start() {
    const loop = ts => {
      const dt = this.last ? Math.min((ts - this.last) / 1000, 0.05) : 0;
      this.last = ts;
      if (this.sim && this.ctx) {
        this.sim.step(this.state, this.pv, dt);
        // 仿真内部事件（打靶命中、小球碰撞…）通过 buzz 计数触发触感反馈
        if ((this.state.buzz | 0) !== this._buzz) { this._buzz = this.state.buzz | 0; this.haptic(); }
        this.ctx.clearRect(0, 0, this.cw, this.ch);
        this.sim.draw(this.ctx, this.cw, this.ch, this.state, this.pv);
      }
      this.raf = this.canvas.requestAnimationFrame(loop);
    };
    this.raf = this.canvas.requestAnimationFrame(loop);
  },

  onSlide(e) {
    const key = e.currentTarget.dataset.key;
    const idx = e.currentTarget.dataset.idx;
    const v = e.detail.value;
    this.pv[key] = v;
    const p = this.sim.params.find(p => p.key === key);
    this.setData({ ['controls[' + idx + '].display']: p.fmt(v) });
    this.redrawIfStatic();
  },

  onAction(e) {
    const i = e.currentTarget.dataset.i;
    this.sim.actions[i].on(this.state, this.pv);
    this.haptic();
    this.setData({ actions: this.labels(), steppers: this.stepperData() });
    this.redrawIfStatic();
  },

  onStep(e) {
    const key = e.currentTarget.dataset.key;
    const delta = Number(e.currentTarget.dataset.delta);
    const idx = e.currentTarget.dataset.idx;
    const st = this.sim.steppers.find(x => x.key === key);
    const next = Math.max(st.min, Math.min(st.max, st.get(this.state) + delta));
    st.set(this.state, next);
    this.haptic();
    this.setData({ ['steppers[' + idx + '].value']: next });
    this.redrawIfStatic();
  },

  onCanvasTap(e) {
    if (!this.sim || !this.sim.onTap) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    this.sim.onTap(this.state, this.pv, t.x, t.y);
    this.redrawIfStatic();
  },

  pauseLoop() {
    if (this.canvas && this.raf) { this.canvas.cancelAnimationFrame(this.raf); this.raf = null; }
  },

  // 切后台 / 息屏时停止动画，回到前台再恢复，避免无意义耗电
  onHide() { this.pauseLoop(); },
  onShow() {
    if (this.canvas && this.sim && !this.sim.static && !this.raf) { this.last = 0; this.start(); }
  },

  onUnload() { this.pauseLoop(); }
});
