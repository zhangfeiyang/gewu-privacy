from playwright.sync_api import sync_playwright


def main() -> None:
    console_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome-stable",
        )
        page = browser.new_page(
            viewport={"width": 390, "height": 720},
            is_mobile=True,
            has_touch=True,
        )
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on(
            "pageerror",
            lambda error: console_errors.append(str(error)),
        )

        page.goto("http://127.0.0.1:8877/shell.html")
        page.wait_for_load_state("networkidle")

        assert "100 个互动仿真" in page.locator("#brand-subtitle").inner_text()
        assert page.locator(".sim-card").count() == 100
        assert page.locator(".category-chip").count() == 7

        page.locator("#about-button").click()
        page.locator("#lang-en").click()
        assert page.locator("#about-title").inner_text() == "About & Settings"
        assert page.locator("#lang-en").evaluate(
            "element => element.classList.contains('active')"
        )
        page.locator("#about-back").click()
        assert "100 interactive simulations" in page.locator(
            "#brand-subtitle"
        ).inner_text()
        assert "Mechanics" in page.locator(".category-chip").first.inner_text()
        page.locator("#search-input").fill("neural")
        assert page.locator(".sim-card").count() == 2
        assert page.locator('.sim-card[data-id="mlp"] strong').inner_text().startswith(
            "Fully Connected Neural Network"
        )
        page.locator("#search-clear").click()
        page.locator('.sim-card[data-id="electrolysis"]').click()
        page.wait_for_function(
            "() => document.getElementById('stage-readout').textContent"
            ".includes('H₂ (cathode)')"
        )
        assert "O₂ (anode)" in page.locator("#stage-readout").inner_text()
        page.locator("#sim-back").click()
        page.locator("#about-button").click()
        page.locator("#lang-zh").click()
        assert page.locator("#about-title").inner_text() == "关于与设置"
        page.locator("#about-back").click()
        assert "100 个互动仿真" in page.locator("#brand-subtitle").inner_text()

        placement_coverage = page.evaluate(
            """() => {
              const { SIMS, READOUT_PLACEMENTS } = window.module.exports;
              const ids = SIMS.map(sim => sim.id);
              return {
                count: Object.keys(READOUT_PLACEMENTS).length,
                missing: ids.filter(id => !READOUT_PLACEMENTS[id]),
                extra: Object.keys(READOUT_PLACEMENTS).filter(
                  id => !ids.includes(id)
                ),
              };
            }"""
        )
        assert placement_coverage == {"count": 100, "missing": [], "extra": []}
        dimensions = page.evaluate(
            """() => {
              const content = document.getElementById('home-content');
              return {
                viewport: innerHeight,
                app: document.getElementById('app').clientHeight,
                client: content.clientHeight,
                scroll: content.scrollHeight,
              };
            }"""
        )
        assert dimensions["app"] == dimensions["viewport"]
        assert dimensions["scroll"] > dimensions["client"]

        cdp = page.context.new_cdp_session(page)
        cdp.send(
            "Input.dispatchTouchEvent",
            {"type": "touchStart", "touchPoints": [{"x": 195, "y": 650}]},
        )
        for y in (570, 490, 410, 330, 250):
            cdp.send(
                "Input.dispatchTouchEvent",
                {"type": "touchMove", "touchPoints": [{"x": 195, "y": y}]},
            )
            page.wait_for_timeout(30)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(300)
        assert page.evaluate("document.getElementById('home-content').scrollTop") > 100
        page.evaluate("document.getElementById('home-content').scrollTop = 0")

        page.locator("#search-input").fill("神经网络")
        assert page.locator(".sim-card").count() == 2
        page.locator("#search-clear").click()
        assert page.locator(".sim-card").count() == 100

        first = page.locator('.sim-card[data-id="projectile"]')
        first.dispatch_event("pointerdown")
        page.wait_for_timeout(600)
        first.dispatch_event("pointerup")
        assert page.evaluate("JSON.parse(localStorage.gw_fav).includes('projectile')")
        assert page.locator("#favorite-section").is_visible()

        page.locator('.sim-card[data-id="projectile"]').click()
        projectile_layout = page.evaluate(
            """() => {
              const stage = document.getElementById('stage');
              const panel = document.querySelector('.control-panel');
              const lastControl = document.querySelector('#control-list .control:last-child');
              return {
                stageHeight: stage.getBoundingClientRect().height,
                controlsFit: lastControl.getBoundingClientRect().bottom <=
                  panel.getBoundingClientRect().bottom + 1,
              };
            }"""
        )
        assert projectile_layout["stageHeight"] < 400
        assert projectile_layout["controlsFit"]
        page.locator("#sim-back").click()

        page.locator('.sim-card[data-id="mlp"]').click()
        assert page.locator("#sim-title").inner_text() == "全连接神经网络"
        assert page.locator("#control-list input[type=range]").count() > 0
        assert page.locator("#action-list button").count() > 0
        page.locator("#control-list input[type=range]").first.evaluate(
            "(element) => { element.value = element.max; "
            "element.dispatchEvent(new Event('input', { bubbles: true })); }"
        )
        page.locator("#sim-back").click()

        page.locator('.sim-card[data-id="atom"]').click()
        assert page.locator(".stepper-row").count() == 3
        page.locator(".stepper-row .plus").first.click()
        page.locator("#sim-back").click()

        page.locator('.sim-card[data-id="kmeans"]').click()
        page.locator("#sim-canvas").click(position={"x": 210, "y": 180})
        page.locator("#sim-back").click()

        page.locator('.sim-card[data-id="electrolysis"]').click()
        page.wait_for_function(
            "() => document.getElementById('stage-readout').textContent"
            ".includes('氢气(阴极)')"
        )
        assert "氧气(阳极)" in page.locator("#stage-readout").inner_text()
        separation = page.evaluate(
            """() => {
              const canvas = document.getElementById('sim-canvas');
              const dock = document.getElementById('stage-readout');
              const canvasRect = canvas.getBoundingClientRect();
              const dockRect = dock.getBoundingClientRect();
              const scale = canvas.width / canvasRect.width;
              const pixel = canvas.getContext('2d').getImageData(
                Math.round(20 * scale), Math.round(20 * scale), 1, 1
              ).data;
              return {
                separated: canvasRect.bottom <= dockRect.top + 0.5,
                topLeftPixel: Array.from(pixel),
              };
            }"""
        )
        assert separation["separated"]
        assert separation["topLeftPixel"][:3] != [255, 255, 255]
        page.locator("#sim-back").click()

        page.locator('.sim-card[data-id="circuitlab"]').click()
        page.wait_for_function(
            "() => document.getElementById('stage-readout').textContent"
            ".includes('组件 / 导线')"
        )
        circuit_canvas = page.locator("#sim-canvas").bounding_box()
        assert circuit_canvas is not None
        canvas_width = circuit_canvas["width"]
        canvas_height = circuit_canvas["height"]
        circuit_top = max(72, min(132, canvas_height * 0.32))
        start_x = circuit_canvas["x"] + canvas_width * 0.2 + 37
        start_y = circuit_canvas["y"] + circuit_top
        end_x = circuit_canvas["x"] + canvas_width * 0.8 - 37
        end_y = start_y
        cdp.send(
            "Input.dispatchTouchEvent",
            {"type": "touchStart", "touchPoints": [{"x": start_x, "y": start_y}]},
        )
        cdp.send(
            "Input.dispatchTouchEvent",
            {"type": "touchMove", "touchPoints": [{"x": end_x, "y": end_y}]},
        )
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_function(
            "() => document.getElementById('stage-readout').textContent"
            ".includes('4 / 1')"
        )
        page.locator('#action-list button[data-index="0"]').click()
        page.wait_for_function(
            "() => document.getElementById('stage-readout').textContent"
            ".includes('回路闭合·电子流动')"
        )
        circuit_canvas_size = page.evaluate(
            """() => {
              const canvas = document.getElementById('sim-canvas');
              const rect = canvas.getBoundingClientRect();
              const dpr = Math.min(devicePixelRatio || 1, 3);
              return {
                widthMatches: canvas.width === Math.round(rect.width * dpr),
                heightMatches: canvas.height === Math.round(rect.height * dpr),
              };
            }"""
        )
        assert circuit_canvas_size == {
            "widthMatches": True,
            "heightMatches": True,
        }
        page.screenshot(path="/tmp/circuitlab-android-ui.png")
        page.locator("#sim-back").click()

        direct_interaction_results = page.evaluate(
            """() => {
              const { SIMS, getSim } = window.module.exports;
              const canvas = document.createElement('canvas');
              canvas.width = 390;
              canvas.height = 420;
              const ctx = canvas.getContext('2d');
              const points = {
                projectile: u => [u.baseX, u.baseY, u.baseX + 100, u.baseY - 25],
                pendulum: u => [u.bx, u.by, u.px - 70, u.py + 80],
                springs: u => [u.cx, u.massTop + 10, u.cx, u.massTop - 35],
                skate: u => [u.X, u.Y, u.left + u.trackW * 0.2, u.Y],
                collision: u => [u.x1, u.cy, u.x1 + 30, u.cy],
                forces: u => [u.X, u.groundY - 20, u.X + 35, u.groundY - 20],
                hooke: u => [u.blockX + 26, u.cy, u.blockX - 25, u.cy],
                lever: u => [u.lx, u.ly, u.fx - u.beamLen * 0.8, u.ly],
                hydraulic: u => [u.lx, u.lPy, u.lx, u.startY + u.travel * 0.8],
                potentiometer: u => [
                  u.barX + u.barW * 0.5, u.barY,
                  u.barX + u.barW * 0.8, u.barY
                ],
                impulse: u => [u.ballX, u.ballY, u.ballX, u.topY + 35],
                circuitlab: u => [
                  u.items[0].x, u.items[0].y,
                  u.items[0].x + 35, u.items[0].y + 24
                ],
              };
              const errors = [];
              let exercised = 0;
              for (const sim of SIMS.filter(item => item.onDragStart)) {
                try {
                  const state = sim.init();
                  const params = Object.fromEntries(sim.params.map(p => [p.key, p.value]));
                  sim.draw(ctx, 390, 420, state, params);
                  const makePoint = points[sim.id];
                  if (!makePoint) throw new Error('missing gesture test point');
                  const [sx, sy, mx, my] = makePoint(state._ui || {});
                  if (sim.onDragStart(state, params, sx, sy) !== true) {
                    throw new Error('drag start rejected');
                  }
                  if (sim.onDragMove) sim.onDragMove(state, params, mx, my);
                  if (sim.onDragEnd) sim.onDragEnd(state, params, mx, my);
                  sim.step(state, params, 0.016);
                  sim.draw(ctx, 390, 420, state, params);
                  exercised++;
                } catch (error) {
                  errors.push(`${sim.id}: ${error.stack || error}`);
                }
              }

              const projectile = getSim('projectile');
              const projectileState = projectile.init();
              const projectileParams = Object.fromEntries(
                projectile.params.map(p => [p.key, p.value])
              );
              projectileParams.height = 6;
              projectile.draw(ctx, 390, 420, projectileState, projectileParams);
              const pui = projectileState._ui;
              const pixels = ctx.getImageData(
                Math.max(0, Math.round(pui.baseX - 28)),
                Math.round(pui.baseY + 18),
                56,
                Math.max(1, Math.round(420 * 0.8 - pui.baseY - 18))
              ).data;
              let supportPixels = 0;
              for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i] < 130 && pixels[i + 1] < 150 && pixels[i + 2] < 160) {
                  supportPixels++;
                }
              }

              const impulse = getSim('impulse');
              const impulseState = impulse.init();
              const impulseParams = Object.fromEntries(
                impulse.params.map(p => [p.key, p.value])
              );
              impulseState.phase = 'contact';
              impulseState.y = 0.78;
              impulse.draw(ctx, 390, 420, impulseState, impulseParams);

              const circuitlab = getSim('circuitlab');
              const circuitState = circuitlab.init();
              const circuitParams = {};
              circuitlab.draw(ctx, 390, 420, circuitState, circuitParams);
              const terminal = key =>
                circuitState._ui.terminals.find(item => item.key === key);
              const connect = (from, to) => {
                const a = terminal(from);
                const b = terminal(to);
                if (!circuitlab.onDragStart(
                  circuitState, circuitParams, a.x, a.y
                )) {
                  throw new Error(`wire start rejected: ${from}`);
                }
                circuitlab.onDragMove(circuitState, circuitParams, b.x, b.y);
                circuitlab.onDragEnd(circuitState, circuitParams, b.x, b.y);
                circuitlab.draw(ctx, 390, 420, circuitState, circuitParams);
              };
              connect('c1:R', 'c2:L');
              connect('c2:R', 'c3:R');
              connect('c3:L', 'c4:R');
              connect('c4:L', 'c1:L');
              const switchItem = circuitState.items.find(item => item.id === 'c4');
              circuitlab.onDragStart(
                circuitState, circuitParams, switchItem.x, switchItem.y
              );
              circuitlab.onDragEnd(
                circuitState, circuitParams, switchItem.x, switchItem.y
              );
              circuitlab.step(circuitState, circuitParams, 0.016);
              circuitlab.draw(ctx, 390, 420, circuitState, circuitParams);
              const paletteBattery = circuitState._ui.palette[0];
              circuitlab.onDragStart(
                circuitState, circuitParams, paletteBattery.x, paletteBattery.y
              );
              circuitlab.onDragMove(circuitState, circuitParams, 190, 320);
              circuitlab.onDragEnd(circuitState, circuitParams, 190, 320);

              return {
                count: SIMS.filter(item => item.onDragStart).length,
                exercised,
                errors,
                supportPixels,
                impulseRadius: impulseState._ui.ballRadius,
                cushionCompression: impulseState._ui.cushionCompression,
                circuitWires: circuitState.wires.length,
                circuitCurrent: circuitState.totalCurrent,
                circuitSwitchOpen: switchItem.open,
                circuitComponents: circuitState.items.length,
              };
            }"""
        )
        assert direct_interaction_results["count"] >= 12
        assert direct_interaction_results["exercised"] == direct_interaction_results["count"]
        assert direct_interaction_results["errors"] == []
        assert direct_interaction_results["supportPixels"] > 20
        assert direct_interaction_results["impulseRadius"] == 15
        assert direct_interaction_results["cushionCompression"] > 0
        assert direct_interaction_results["circuitWires"] == 4
        assert direct_interaction_results["circuitCurrent"] > 0.3
        assert direct_interaction_results["circuitSwitchOpen"] is False
        assert direct_interaction_results["circuitComponents"] == 5

        simulation_errors = page.evaluate(
            """() => {
              const errors = [];
              const canvas = document.createElement('canvas');
              canvas.width = 390;
              canvas.height = 420;
              const ctx = canvas.getContext('2d');
              for (const sim of window.module.exports.SIMS) {
                try {
                  const state = sim.init();
                  const params = Object.fromEntries(sim.params.map(p => [p.key, p.value]));
                  sim.step(state, params, 0);
                  sim.draw(ctx, 390, 420, state, params);
                  for (const action of sim.actions) action.on(state, params);
                  for (const stepper of (sim.steppers || [])) {
                    stepper.set(state, Math.min(stepper.max, stepper.get(state) + 1));
                  }
                  if (sim.onTap) sim.onTap(state, params, 195, 210);
                  sim.step(state, params, sim.static ? 0 : 0.016);
                  sim.draw(ctx, 390, 420, state, params);
                } catch (error) {
                  errors.push(`${sim.id}: ${error.stack || error}`);
                }
              }
              return errors;
            }"""
        )
        assert simulation_errors == [], "\n".join(simulation_errors)
        assert console_errors == [], "\n".join(console_errors)
        browser.close()

    print("Verified 100 simulations, home features, controls, steppers, and canvas input.")


if __name__ == "__main__":
    main()
