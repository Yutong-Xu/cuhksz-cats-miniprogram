# CUHK(SZ) 猫猫图鉴

微信小程序,基于原生框架 + 云开发(CloudBase)。

## 目录结构

```
├── app.js / app.json / app.wxss     # 全局
├── pages/
│   ├── index/   # 首页 4 板块
│   ├── list/    # 按 status 展示猫猫列表
│   └── detail/  # 猫猫详情 + 评论区
└── project.config.json
```

## 跑起来的 4 步

### 1. 准备
- 下载「微信开发者工具」
- 在 <https://mp.weixin.qq.com/> 注册小程序账号,拿到 **AppID**(个人号即可)

### 2. 开通云开发
- 开发者工具里点击顶部「云开发」按钮,创建环境,会得到一个 **环境 ID**(如 `cuhksz-cats-7g1a2b3c4d`)
- 把 `app.js` 里的 `env: 'your-env-id'` 替换成你的环境 ID
- 把 `project.config.json` 里的 `"appid": "touristappid"` 替换成你的 AppID

### 3. 建数据库集合
在云开发控制台的「数据库」里手动创建两个集合:
- `cats`
- `comments`

**权限设置**(两个都要改):
- `cats`:所有用户可读,仅创建者可读写(先这样,管理员功能后做)
- `comments`:所有用户可读,仅创建者可读写

### 4. 导入测试数据
在 `cats` 集合里点「导入」,用下面的 JSON 测试:

```json
{"name":"橘座","gender":"male","status":"current","location":"下园食堂后","neutered":true,"personality":"极度亲人,讨摸时翻肚皮。见到饭盒会直接跟人走。","photos":["https://placekitten.com/800/800"],"createdAt":"2024-09-01T00:00:00.000Z"}
{"name":"奶糖","gender":"female","status":"current","location":"诚道图书馆旁","neutered":true,"personality":"胆小,需要慢慢接触。喜欢躲在灌木丛里。","photos":["https://placekitten.com/801/801"],"createdAt":"2024-10-01T00:00:00.000Z"}
{"name":"黑芝麻","gender":"male","status":"adoption","location":"志同宿舍区","neutered":false,"personality":"活泼好动,适合家里有另一只猫的铲屎官。","photos":["https://placekitten.com/802/802"],"createdAt":"2025-01-15T00:00:00.000Z"}
{"name":"小花","gender":"female","status":"fostering","location":"校医院(治疗中)","neutered":true,"personality":"正在治疗耳螨,性格温顺。","photos":["https://placekitten.com/803/803"],"createdAt":"2025-03-01T00:00:00.000Z"}
{"name":"老白","gender":"male","status":"historical","location":"(已不在校园)","neutered":true,"personality":"CUHK(SZ) 最早的猫之一,2023 年被好心学长领养回家。","photos":["https://placekitten.com/804/804"],"createdAt":"2020-09-01T00:00:00.000Z"}
```

### 5. 编译预览
开发者工具里点击「编译」,应该就能跑起来了。

## 迭代 TODO(按优先级)

- [ ] **管理员录入页**:现在录猫只能进数据库后台,做一个 admin 入口页允许白名单微信号上传照片、建档
- [ ] **点赞**:comments 加 `likes` 字段,猫猫也可以加「今天谁见过」打卡
- [ ] **地图模式**:首页加一个地图 tab,根据 location 撒点
- [ ] **登录体系**:`wx.cloud.callFunction` 写个 login 云函数拿 openid,管理员白名单用
- [ ] **评论审核**:加一个 `reviewed` 字段,敏感词/举报机制
- [ ] **猫猫历史事件**:status 变化做时间线(例:`current → fostering → current`)
- [ ] **图片压缩**:上传前 `wx.compressImage`,省流量 + 省存储
- [ ] **分享卡片**:`onShareAppMessage` 让同学能把某只猫分享到朋友群

## 关键设计说明

- **单表 status 字段驱动四板块**:避免了四张表的冗余,未来加新状态(例如 `lost`)只需加一个枚举值
- **照片走云存储,DB 只存 fileID**:`wx.cloud.uploadFile` 返回的 fileID 能被 `<image src>` 直接渲染,不用签 URL
- **评论匿名兜底**:`wx.getUserProfile` 被拒绝时退化为「匿名同学」,不强制登录
- **没用云函数**:客户端直接 `db.collection().add()` 够了。等需要服务端校验(审核、白名单)再上云函数
