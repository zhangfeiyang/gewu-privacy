from playwright.sync_api import sync_playwright


def main() -> None:
    console_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome-stable",
        )
        page = browser.new_page(
            viewport={"width": 390, "height": 844},
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
            {"type": "touchStart", "touchPoints": [{"x": 195, "y": 740}]},
        )
        for y in (650, 560, 470, 380, 290):
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
