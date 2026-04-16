/* 通用工具函数 - 所有页面共享 */

const API = 'http://127.0.0.1:18765';

/**
 * 带重试的 JSON fetch
 */
async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok && r.status >= 500 && i < retries - 1) {
        await new Promise(res => setTimeout(res, 500));
        continue;
      }
      return await r.json();
    } catch(e) {
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, 500));
        continue;
      }
      throw e;
    }
  }
}

/**
 * Toast 提示
 */
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 2800);
}

// ── 平滑曲线图工具 ──────────────────────────────────────

/**
 * 简单折线 - 直接用直线连接各点
 * @param {Array<{x:number,y:number}>} pts 数据点
 * @returns {string} SVG path d 属性
 */
function simpleLinePath(pts) {
  if (!pts || pts.length < 1) return '';
  // 单点：画一个小圆点
  if (pts.length === 1) {
    const r = 3;
    const x = pts[0].x, y = pts[0].y;
    return `M ${x-r} ${y} A ${r} ${r} 0 1 0 ${x+r} ${y} A ${r} ${r} 0 1 0 ${x-r} ${y}`;
  }
  // 用直线连接各点
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}


/**
 * 绘制单条曲线到 SVG 元素（仅显示累计总数）
 * @param {Array<{date:string,added:number,total:number}>} data 数据点
 * @param {string} range 范围类型 (today/week/month/all)
 */
function drawChartCurve(data, range) {
  const svgW = 700, svgH = 120, padTop = 8, padBottom = 4, padX = 10;
  const lineTotal = document.getElementById('curveLineTotal');

  if (!lineTotal) return;

  // 空数据
  if (!data || data.length < 1) {
    lineTotal.setAttribute('d', '');
    return;
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const usableW = svgW - padX * 2;
  const stepX = usableW / Math.max(data.length - 1, 1);

  const totalPts = data.map((d, i) => ({
    x: padX + stepX * i,
    y: padTop + (svgH - padTop - padBottom) * (1 - d.total / maxTotal),
  }));

  const dTotal = simpleLinePath(totalPts);
  lineTotal.setAttribute('d', dTotal);
}
