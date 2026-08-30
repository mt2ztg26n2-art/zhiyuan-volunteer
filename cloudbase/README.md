# CloudBase 云端化迁移（方案 A · 腾讯云云开发）

把宣汉职校志愿服务平台从「GitHub Pages 静态托管 + localStorage 单机 + Supabase blob 同步」
迁移到「腾讯云 CloudBase：云函数鉴权 + 云数据库 + 服务端权限过滤」。
解决：Supabase 免费版 7 天无访问暂停、多设备共享单库、密码明文等遗留风险。

## 架构

```
浏览器（GitHub Pages 静态托管，永久地址不变）
   │  HTTPS POST JSON {action, token, ...}
   ▼
CloudBase 云函数 zy-api（唯一数据入口，HTTP 触发）
   │  bcrypt 校验 + JWT 会话 + 服务端角色/部门过滤
   ▼
CloudBase 文档数据库 zy_db（单文档 id=1 存整库 JSON）
```

- 登录/注册/重置密码/审核全部走云函数，密码只存 bcrypt 哈希
- 拉取时按角色服务端过滤：超级/终端/dev 全量；管理级本部门；普通成员仅本人
- 前端 `zy-cloudbase.js` 与旧 `zy-sync.js` 同一套 API，替换一个 script 标签即可

## 目录

| 文件 | 作用 |
|---|---|
| `functions/zy-api/index.js` | 云函数（登录/注册/重置密码/审核/拉取/推送/导入） |
| `functions/zy-api/package.json` | 云函数依赖（node-sdk + bcryptjs） |
| `migrate-supabase-to-cloudbase.mjs` | 解密 Supabase 密文 → bcrypt 化 → 迁移 JSON |
| `deploy.py` | 一键部署云函数（需 tencentcloud-sdk-python） |
| `verify.py` | 密钥验证 + 环境探测 |
| `creds.example.json` | 凭据模板（复制为 creds.json 填写） |
| `creds.json` | 你的腾讯云密钥（**gitignored，勿提交**） |

## 部署步骤

1. **准备密钥**：腾讯云控制台 → 访问管理 → 新建子用户 + API 密钥，
   关联策略 `QcloudTCBFullAccess`。把 SecretId/SecretKey 填到 `.cloudbase/creds.json`
   （envId 留空则需先在控制台创建环境）。

2. **验证密钥**：
   ```bash
   python cloudbase/verify.py          # 应输出「密钥验证通过」+ 环境列表
   ```

3. **部署云函数**：
   ```bash
   pip install tencentcloud-sdk-python
   python cloudbase/deploy.py --env <envId>
   ```
   或在腾讯云控制台：云开发 → 云函数 → 新建 zy-api（Nodejs16.13，
   handler `index.main`，上传 functions/zy-api 目录，安装依赖），
   再开启「HTTP 访问服务」拿到 URL。

4. **前端启用**：把云函数 HTTP URL 填入 `index.html` 中
   `window.ZY_CB_ENDPOINT = 'https://xxx.service.tcloudbase.com/zy-api'`，
   并把脚本引用从 `zy-sync.js` 换成 `zy-cloudbase.js`，版本戳 +1 后推送 GitHub Pages。

5. **迁移数据**（可选，把现有 Supabase 数据搬过来）：
   ```bash
   # 先取 Supabase zy_db 表 data 列密文存到 supabase-db.txt
   node cloudbase/migrate-supabase-to-cloudbase.mjs supabase-db.txt cloudbase/seed-db.json
   ```
   然后以 校团委/终端管理员 登录 → 云函数 import action 导入 seed-db.json
   （或用部署脚本扩展一个 import 步骤）。

## 测试清单（部署后必测）

- [ ] 成员手机注册 → 本部门管理员电脑审核中心出现（15s 内）
- [ ] 审核通过 → 通知中心红色角标 + 列表出现 → 成员可登录
- [ ] 审核驳回 → 成员收到通知，身份证释放可重注册
- [ ] 管理员 A 电脑改数据 → 管理员 B 手机 15s 内同步
- [ ] 忘记密码 → 姓名方式 / 5 分钟动态口令方式均能重置
- [ ] 普通成员登录后拉取的数据不含他人档案（服务端过滤生效）
- [ ] 清除演示数据后云端同步清空（import 空库）
