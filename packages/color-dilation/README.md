### 说明

通过将图片中所有透明像素（alpha === 0）的 RGB 改写为，与其最临近非完全透明像素（alpha>0）的 RGB，达到去除图片黑边的效果。

### 使用

可直接使用 example 中的工具对图片进行处理，或者在代码中使用：

```typescript
// 传入待处理文件的 arrayBuffer
const blob = await dilateColor(arrayBuffer, { range: 10, alpha: 0 });
```

### 示意图

![avatar](https://mdn.alipayobjects.com/huamei_qbugvr/afts/img/A*jYcNQJmDYjsAAAAAAAAAAAAADtKFAQ/original)

### 去黑边/白边

在场景中图片出现黑边/白边：

1. 图片 wrapMode 是否被错误的设置为 Repeat / Clamp (循环或强制拉伸)
2. 图片 filterMode 改为 Point （点采样）后能否改善
3. 图片黑边/白边出现在和透明区域相交处，可以通过此像素膨胀的方法进行改善
