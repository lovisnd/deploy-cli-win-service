# deploy-cli-win-service
根据原作者的项目修改而来，自用，原作者：https://github.com/fuchengwei
前端一键自动化部署脚手架服务，支持开发、测试、生产多环境配置。配置好后一键即可自动完成部署。(服务器为windows适用，linux服务器可找原作者项目https://github.com/fuchengwei/deploy-cli-service)

### github

[https://github.com/lovisnd/deploy-cli-win-service](https://github.com/lovisnd/deploy-cli-win-service)

### npm

[https://www.npmjs.com/package/deploy-cli-win-service](https://www.npmjs.com/package/deploy-cli-win-service)


## 1 安装

全局安装 deploy-cli-win-service

```shell
npm install deploy-cli-win-service -g
```

本地安装 deploy-cli-win-service

```shell
npm install deploy-cli-win-service --save-dev
```

查看版本，表示安装成功

```javascript
deploy-cli-win-service - v
```

注：本地安装的需要在调用前加 `npx`

```shell
npx deploy-cli-win-service -v
```

![](https://ae01.alicdn.com/kf/U943f01b07cdd492499f3186582d813c8n.jpg)

### 2 使用（以下代码都以全局安装为例）

#### 2.1 查看帮助

```shell
deploy-cli-win-service -h
```

![](https://ae01.alicdn.com/kf/Ud0667faaa3ef44939c8c016eb8a1cc026.jpg)

#### 2.2 初始化配置文件（在项目目录下）

```shell
deploy-cli-win-service init # 或者使用简写 deploy-cli-win-service i
```

根据提示填写内容，会在项目根目录下生成 `deploy.config.js` 文件，初始化配置只会生成 `dev` (开发环境)、`test` (测试环境)、`prod` (生产环境) 三个配置，再有其他配置可参考模板自行配置。

![](https://ae01.alicdn.com/kf/Uf9bb311b13764e4aa25c51d57b52bdc2Z.jpg)

#### 2.3 手动创建或修改配置文件

在项目根目录下手动创建 `deploy.config.js` 文件，复制以下代码按情况修改即可。

```javascript
module.exports = {
  projectName: 'vue_samples', // 项目名称
  privateKey: '/Users/lovisnd/.ssh/id_rsa',
  passphrase: '',
  readyTimeout: 20000, // 超时时间(毫秒)
  cluster: [], // 集群部署配置，要同时部署多台配置此属性如: ['dev', 'test', 'prod']
  dev: {
    // 环境对象
    name: '开发环境', // 环境名称
    script: 'npm run build', // 打包命令
    host: '192.168.0.1', // 服务器地址
    port: 22, // 服务器端口号
    username: 'test', // 服务器登录用户名
    password: '1234', // 服务器登录密码
    distPath: 'dist', // 本地打包生成目录
    windowsPath:'D:\\nginx-1.23.4\\web\\test\\',//windows服务需配置服务器本地项目路径
    webDir: '/test/dist', // 服务器部署路径（不可为空或'/'）
    bakDir: 'D:\\nginx-1.23.4\\web\\back\\', // 备份路径 (打包前备份之前部署目录 最终备份路径为 /usr/local/nginx/backup/html.zip)
    isRemoveRemoteFile: true, // 是否删除远程文件（默认true）
    isRemoveLocalFile: true // 是否删除本地文件（默认true）
  }
}
```

#### 2.4 部署 （在项目目录下）

注意：命令后面需要加 `--mode` 环境对象 （如：`--mode dev`）

```shell
deploy-cli-win-service deploy --mode dev # 或者使用 deploy-cli-win-service d --mode dev
```

输入 `Y` 确认后即可开始自动部署，看见如下提示说明部署完成

![](https://ae01.alicdn.com/kf/U6c196c63cab242cd894371c6d0725d87Q.jpg)

#### 2.5 集群部署 （在项目目录下）

注意：集群配置需要在 `deploy-cli-win-service` 中 配置 `cluster` 字段 （如：`cluster: ['dev', 'test', 'prod']`）

```shell
deploy-cli-win-service deploy # 或者使用 deploy-cli-win-service d
```

输入 `Y` 确认后即可开始自动部署，看见如下提示说明部署完成

![](https://ae01.alicdn.com/kf/Ue11c75ee338844ac9f3668686879f988E.jpg)

#### 2.6 更新优化

如果不想把服务器密码保存在配置文件中，也可以在配置文件中删除 `password` 字段。在部署的时候会弹出输入密码界面。

如果不想在部署前执行打包命令，在配置文件中删除 `script` 字段即可。

如果需要部署前备份，在配置文件中配置 `bakDir` 字段，为空不会备份。ps: 服务器需要安装 zip 模块，可使用 yum install zip 命令。

#### 2.7 本地安装扩展

如果使用本地安装命令的话，可以在项目根目录下的 `package.json` 文件中 `scripts` 脚本中添加如下代码

```json
"scripts": {
  "serve": "vue-cli-service serve",
  "build": "vue-cli-service build",
  "lint": "vue-cli-service lint",
  "deploy": "deploy-cli-win-service deploy",
  "deploy:dev": "deploy-cli-win-service deploy --mode dev",
  "deploy:test": "deploy-cli-win-service deploy --mode test",
  "deploy:prod": "deploy-cli-win-service deploy --mode prod"
}
```

然后使用下面代码也可以完成部署操作

```shell
npm run deploy:dev
```

最后如果大家觉得还不错挺好用的话，麻烦给个 Star 😜😜😜。
