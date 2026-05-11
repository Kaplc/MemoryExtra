# Shader 透明

> 创建时间：2026-04-29
> 更新时间：2026-05-10

## 渲染队列

Unity 渲染顺序：**Geometry → AlphaTest → Transparent → Overlay**

## AlphaTest（打洞效果）

- 在片元着色器用 **clip()** 丢弃透明度过低的像素，丢弃的像素不写入深度/颜色缓冲区
- 适合栅栏、树叶、窗户等需要"打洞"的场景
- 不需要排序，丢弃的像素不参与深度测试

## 半透明效果（Transparent）

- 用 **Blend** 混合实现半透明
- 开启透明混合：`Blend SrcAlpha OneMinusSrcAlpha`
- 关闭深度写入（`ZWrite Off`），但保持深度测试（`ZTest LEqual`）
- 需要从远到近排序渲染，顺序错了会显示错误
- 适合玻璃、水面等混合效果

## 深度设置总结

| 效果 | ZWrite | ZTest | 像素处理 | 需要排序 |
|------|--------|-------|---------|---------|
| AlphaTest | On | On | clip 丢弃 | 不需要 |
| Transparent | Off | On | Blend 混合 | 需要从远到近 |

**关键**：半透明不需要关闭深度测试，而是关闭深度写入。关掉 ZTest 会出现错误遮挡。

---

*由 猫猫 创建，更新于 2026-05-10*