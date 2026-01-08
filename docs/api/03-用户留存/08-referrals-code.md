# 获取推荐码

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/referrals/code` |
| **方法** | `GET` |
| **认证** | 需要 |
| **权限** | 登录用户 |

## 查询参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `customer_id` | string | 是 | 客户 ID |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `code` | string | 推荐码 |
| `share_url` | string | 分享链接 |
| `rewards` | object | 奖励说明 |

### Rewards 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `referrer_points` | number | 推荐人获得积分 |
| `referee_discount` | number | 被推荐人首单折扣 (%) |
| `referee_points` | number | 被推荐人获得积分 |

## 响应示例

```json
{
  "code": "JOHN2024",
  "share_url": "https://brand.com/ref/JOHN2024",
  "rewards": {
    "referrer_points": 500,
    "referee_discount": 10,
    "referee_points": 200
  }
}
```
