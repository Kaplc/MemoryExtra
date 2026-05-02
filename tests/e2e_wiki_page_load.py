"""Wiki 页面 E2E 测试"""
from playwright.sync_api import sync_playwright
import requests
import time

BASE = "http://127.0.0.1:19398"


def test_wiki_page():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"[PAGEERROR] {e}"))

        page.goto(BASE + "/", wait_until="load", timeout=30000)
        page.wait_for_timeout(2000)

        # 切换到 wiki 页面
        page.click('.nav-item[data-page="wiki"]')
        page.wait_for_timeout(5000)

        # 等待文件列表渲染完成
        page.wait_for_selector("#wikiTableWrap tbody tr", timeout=10000)
        rows_init = page.evaluate(
            "() => document.querySelectorAll('#wikiTableWrap tbody tr').length"
        )
        print(f"[E2E] 初始文件列表行数: {rows_init}")

        # 注入调试：跟踪 loadWikiData 的调用参数和结果
        page.evaluate("""() => {
            window.__debug_logs = [];
            const origLoadWikiData = window.loadWikiData;
            window.loadWikiData = function(skipRender) {
                const wrap = document.getElementById('wikiTableWrap');
                const before = wrap ? wrap.innerHTML.substring(0, 100) : 'NO_WRAP';
                window.__debug_logs.push('called skipRender=' + String(skipRender));
                const result = origLoadWikiData.apply(this, arguments);
                const after = wrap ? wrap.innerHTML.substring(0, 100) : 'NO_WRAP';
                window.__debug_logs.push('before=' + before.substring(0, 50) + ' after=' + after.substring(0, 50));
                return result;
            };
        }""")

        # 切换到操作 tab
        page.click('button[data-tab="ops"]')
        page.wait_for_timeout(1000)

        btn = page.query_selector("#btnReindex")
        assert btn and btn.is_visible(), "重建索引按钮不可见"
        print("[E2E] ✓ 重建索引按钮可见")

        # 点击重建索引
        btn.click()
        page.wait_for_timeout(1000)

        # 轮询直到完成
        for i in range(30):
            resp = requests.get(BASE + "/wiki/index-progress")
            pdata = resp.json()
            print(f"[E2E] 轮询 {i+1}: status={pdata['status']} done={pdata['done']}/{pdata['total']}")
            if pdata["status"] in ("done", "error"):
                break
            time.sleep(1)

        page.wait_for_timeout(3000)

        # 检查调试日志
        debug = page.evaluate("() => window.__debug_logs || []")
        print(f"[E2E] loadWikiData 调试日志: {debug}")

        # 检查最终状态
        rows = page.evaluate(
            "() => document.querySelectorAll('#wikiTableWrap tbody tr').length"
        )
        result = page.evaluate("""() => {
            const fill = document.querySelector("#indexProgressFill");
            const pct = document.querySelector("#indexProgressPct");
            const resultDiv = document.querySelector("#indexResult");
            const wrap = document.getElementById("wikiTableWrap");
            return {
                fill: fill ? fill.style.width : "null",
                pct: pct ? pct.textContent : "null",
                result: resultDiv ? resultDiv.innerText : "null",
                wrap_html: wrap ? wrap.innerHTML.substring(0, 200) : "null",
            };
        }""")
        print(f"[E2E] 文件列表行数: {rows}")
        print(f"[E2E] 进度条: {result}")

        wiki_errors = [e for e in errors if "WikiFile" in e]
        print(f"[E2E] WikiFile 错误: {wiki_errors}")

        assert rows > 0, f"文件列表为空"
        assert not wiki_errors, f"存在 WikiFile 错误: {wiki_errors}"
        print("[E2E] ✓ 测试通过")
        browser.close()


if __name__ == "__main__":
    test_wiki_page()
