# 03-用户留存

用户留存功能 API，包括积分系统、会员等级和推荐有礼。

## 接口列表

### 积分系统 (points.ts)
- [01-获取积分余额](./01-points-balance.md) - `GET /api/points/balance`
- [02-获取积分历史](./02-points-history.md) - `GET /api/points/history`
- [03-获取积分规则](./03-points-rules.md) - `GET /api/points/rules`
- [04-获得积分](./04-points-earn.md) - `POST /api/points/earn`
- [05-兑换积分](./05-points-redeem.md) - `POST /api/points/redeem`

### 会员等级 (membership.ts)
- [06-获取会员等级](./06-membership-levels.md) - `GET /api/membership/levels`
- [07-获取客户会员信息](./07-membership-customer.md) - `GET /api/membership/customers/:customerId`

### 推荐有礼 (referrals.ts)
- [08-获取推荐码](./08-referrals-code.md) - `GET /api/referrals/code`
- [09-获取推荐统计](./09-referrals-stats.md) - `GET /api/referrals/stats`
- [10-使用推荐码](./10-referrals-apply.md) - `POST /api/referrals/apply`
