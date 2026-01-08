# 使用推荐码

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/referrals/apply` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |

## 描述

新用户使用推荐码，在首单时可获得折扣。

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | string | 是 | 推荐码 |
| `email` | string | 是 | 新用户邮箱 |

## 请求示例

```json
{
  "code": "JOHN2024",
  "email": "newuser@example.com"
}
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `valid` | boolean | 推荐码是否有效 |
| `discount` | object | 折扣信息 |

## 响应示例

```json
{
  "success": true,
  "valid": true,
  "discount": {
    "type": "percentage",
    "value": 10,
    "description": "10% off your first order"
  }
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Invalid referral code | 推荐码无效 |
| 400 | Email already registered | 邮箱已注册 |
| 400 | Cannot use your own code | 不能使用自己的推荐码 |
