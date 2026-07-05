from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT = Path("/tmp/phet-sim-gallery")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for old in OUTPUT.glob("*.png"):
        old.unlink()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome-stable",
        )
        page = browser.new_page(viewport={"width": 410, "height": 460})
        page.goto("http://127.0.0.1:8877/shell.html")
        page.wait_for_load_state("networkidle")
        sim_ids = page.evaluate(
            "() => window.module.exports.SIMS.map(sim => sim.id)"
        )
        page.evaluate(
            """() => {
              document.body.innerHTML =
                '<canvas id="audit" width="390" height="420" ' +
                'style="display:block;width:390px;height:420px"></canvas>';
            }"""
        )

        for index, sim_id in enumerate(sim_ids, start=1):
            errors = page.evaluate(
                """(id) => {
                  const sim = window.module.exports.getSim(id);
                  const state = sim.init();
                  const params = Object.fromEntries(
                    sim.params.map(param => [param.key, param.value])
                  );
                  const canvas = document.getElementById('audit');
                  const ctx = canvas.getContext('2d');
                  ctx.setTransform(1, 0, 0, 1, 0, 0);
                  ctx.globalAlpha = 1;
                  ctx.clearRect(0, 0, 390, 420);
                  try {
                    if (sim.actions[0]) sim.actions[0].on(state, params);
                    for (let frame = 0; frame < 80; frame++) {
                      sim.step(state, params, 1 / 60);
                    }
                    sim.draw(ctx, 390, 420, state, params);
                    return '';
                  } catch (error) {
                    return error.stack || String(error);
                  }
                }""",
                sim_id,
            )
            if errors:
                raise RuntimeError(f"{sim_id}: {errors}")
            page.locator("#audit").screenshot(
                path=str(OUTPUT / f"{index:03d}_{sim_id}.png")
            )
        browser.close()

    print(f"Rendered {len(sim_ids)} simulations to {OUTPUT}")


if __name__ == "__main__":
    main()
