# 图片处理流程图

## 13.1 图片处理模块

```mermaid
flowchart TB
    subgraph Upload["📤 上传"]
        Original["原始图片<br/>JPG/PNG/GIF"]
    end
    
    subgraph Processing["⚙️ 处理"]
        Compress["压缩优化"]
        WebP["WebP 转换"]
        Resize["尺寸调整"]
        Variants["生成变体<br/>thumbnail/medium/large"]
    end
    
    subgraph Storage["💾 存储"]
        CF["Cloudflare Images"]
        R2["Cloudflare R2"]
    end
    
    subgraph Delivery["🚀 分发"]
        CDN["CDN 分发"]
        Lazy["懒加载"]
        Srcset["响应式 srcset"]
    end
    
    Upload --> Processing --> Storage --> Delivery
```

## 13.2 图片上传流程

```mermaid
sequenceDiagram
    autonumber
    participant A as 👤 Admin
    participant W as ⚙️ Worker
    participant CF as ☁️ Cloudflare Images
    participant DB as 🗄️ Supabase

    A->>W: POST /api/images/upload<br/>multipart/form-data
    W->>W: 验证文件类型/大小
    W->>CF: 上传到 Cloudflare Images
    CF->>CF: 自动压缩 + WebP
    CF-->>W: {id, variants: [...]}
    
    W->>DB: 保存图片记录
    W-->>A: {url, variants}
```

## 13.3 图片变体生成

```mermaid
flowchart LR
    subgraph Original["📷 原图"]
        Src["2000x2000<br/>2MB"]
    end
    
    subgraph Variants["📐 变体"]
        Thumb["thumbnail<br/>150x150<br/>~10KB"]
        Medium["medium<br/>600x600<br/>~50KB"]
        Large["large<br/>1200x1200<br/>~150KB"]
    end
    
    subgraph Formats["📁 格式"]
        JPG["JPEG"]
        WEBP["WebP<br/>(优先)"]
        AVIF["AVIF<br/>(现代浏览器)"]
    end
    
    Original --> Variants --> Formats
```

## 13.4 响应式图片使用

```html
<picture>
  <source 
    type="image/avif" 
    srcset="product-150.avif 150w,
            product-600.avif 600w,
            product-1200.avif 1200w">
  <source 
    type="image/webp" 
    srcset="product-150.webp 150w,
            product-600.webp 600w,
            product-1200.webp 1200w">
  <img 
    src="product-600.jpg" 
    alt="Product"
    loading="lazy"
    sizes="(max-width: 640px) 100vw, 600px">
</picture>
```
