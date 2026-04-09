/**
 * R2 图片上传脚本
 * 将筛选后的产品图片上传到 Cloudflare R2
 * 
 * 使用方法：
 * 1. 确保 .env 文件中配置了 R2 凭证
 * 2. 运行: node scripts/upload-to-r2.js
 */

const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../worker/.dev.vars') });

// R2 配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'cmsbike-assets';
const R2_ENDPOINT = process.env.R2_ENDPOINT;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ 缺少 R2 凭证，请检查 worker/.dev.vars 文件');
  process.exit(1);
}

// 创建 S3 客户端（R2 兼容 S3 API）
const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// 14寸自行车图片映射
const filesToUpload = [
  {
    localPath: 'brands/cmsbike/英文-14寸一秒折叠自行车/白底图/黑色1.jpg',
    r2Key: '14-inch/black-side.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/英文-14寸一秒折叠自行车/白底图/灰色1.jpg',
    r2Key: '14-inch/gray-side.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/英文-14寸一秒折叠自行车/白底图/细节变速.jpg',
    r2Key: '14-inch/detail-derailleur.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/英文-14寸一秒折叠自行车/白底图/细节铝轮碟刹.jpg',
    r2Key: '14-inch/detail-disc-brake.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/英文-14寸一秒折叠自行车/白底图/细节折叠车把.JPG',
    r2Key: '14-inch/detail-handlebar.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/英文-14寸一秒折叠自行车/视频/14寸一秒折叠自行车（英文版）/302cb03f4bafa4f052660391a27d8fba_raw.mp4',
    r2Key: '14-inch/folding-demo.mp4',
    contentType: 'video/mp4'
  },
  // 16寸电动车 - 主图
  {
    localPath: 'brands/cmsbike/16寸一秒折叠电动车/英文-16寸一秒折叠电动车/主图/1.jpg',
    r2Key: 'ebike-16/hero-folding.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/16寸一秒折叠电动车/英文-16寸一秒折叠电动车/主图/4.jpg',
    r2Key: 'ebike-16/lifestyle-charging.jpg',
    contentType: 'image/jpeg'
  },
  // 16寸电动车 - 详情页
  {
    localPath: 'brands/cmsbike/16寸一秒折叠电动车/英文-16寸一秒折叠电动车/详情页/1.jpg',
    r2Key: 'ebike-16/product-hero.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/16寸一秒折叠电动车/英文-16寸一秒折叠电动车/详情页/9.jpg',
    r2Key: 'ebike-16/detail-sensor-tire.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/16寸一秒折叠电动车/英文-16寸一秒折叠电动车/详情页/10.jpg',
    r2Key: 'ebike-16/detail-brake-wheel.jpg',
    contentType: 'image/jpeg'
  },
  {
    localPath: 'brands/cmsbike/16寸一秒折叠电动车/英文-16寸一秒折叠电动车/详情页/14.jpg',
    r2Key: 'ebike-16/side-view.jpg',
    contentType: 'image/jpeg'
  }
];

async function uploadFile(localPath, r2Key, contentType) {
  const fullPath = path.join(__dirname, '..', localPath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${localPath}`);
    return false;
  }

  const fileContent = fs.readFileSync(fullPath);
  const fileSizeMB = (fileContent.length / 1024 / 1024).toFixed(2);

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileContent,
      ContentType: contentType,
    }));
    console.log(`✅ 上传成功: ${r2Key} (${fileSizeMB}MB)`);
    return true;
  } catch (error) {
    console.error(`❌ 上传失败: ${r2Key}`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 开始上传 14寸自行车图片到 R2...\n');
  console.log(`📦 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`🌐 Endpoint: ${R2_ENDPOINT}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of filesToUpload) {
    const success = await uploadFile(file.localPath, file.r2Key, file.contentType);
    if (success) successCount++;
    else failCount++;
  }

  console.log(`\n📊 上传完成: ${successCount} 成功, ${failCount} 失败`);
  
  if (successCount > 0) {
    console.log('\n🔗 公开访问 URL:');
    console.log('https://assets.cmsbike.uk/14-inch/black-side.jpg');
    console.log('https://assets.cmsbike.uk/14-inch/gray-side.jpg');
    console.log('https://assets.cmsbike.uk/14-inch/folding-demo.mp4');
  }
}

main().catch(console.error);
