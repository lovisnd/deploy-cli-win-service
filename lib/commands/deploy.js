const fs = require('fs')
const { pathToFileURL } = require('url')
const ora = require('ora')
const dayjs = require('dayjs')
const inquirer = require('inquirer')
const archiver = require('archiver')
const { NodeSSH } = require('node-ssh')
const childProcess = require('child_process')
const { deployConfigPath } = require('../config')
const {
  checkDeployConfigExists,
  getDeployConfigFileName,
  log,
  succeed,
  error,
  underline
} = require('../utils')

const ssh = new NodeSSH()
const maxBuffer = 5000 * 1024

// 任务列表
let taskList

// 是否确认部署
const confirmDeploy = (message) => {
  return inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message
    }
  ])
}

// 检查环境是否正确
const checkEnvCorrect = (config, env) => {
  const keys = ['name', 'host', 'port', 'username', 'distPath', 'webDir']

  if (config) {
    keys.forEach((key) => {
      if (!config[env][key] || config[env][key] === '/') {
        error(
          `配置错误: ${underline(`${env}环境`)} ${underline(
            `${key}属性`
          )} 配置不正确`
        )
        process.exit(1)
      }
    })
  } else {
    error('配置错误: 未指定部署环境或指定部署环境不存在')
    process.exit(1)
  }
}

// 执行打包脚本
const execBuild = async (config, index) => {
  try {
    const { script } = config
    log(`(${index}) ${script}`)
    const spinner = ora('正在打包中\n')

    spinner.start()

    await new Promise((resolve, reject) => {
      childProcess.exec(
        script,
        { cwd: process.cwd(), maxBuffer: maxBuffer },
        (e) => {
          spinner.stop()
          if (e === null) {
            succeed('打包成功')
            resolve()
          } else {
            reject(e.message)
          }
        }
      )
    })
  } catch (e) {
    error('打包失败')
    error(e)
    process.exit(1)
  }
}

// 打包Zip
const buildZip = async (config, index) => {
  await new Promise((resolve, reject) => {
    log(`(${index}) 打包 ${underline(config.distPath)} Zip`)
    const archive = archiver('zip', {
      zlib: { level: 9 },
      forceLocalTime: true
    }).on('error', (e) => {
      error(e)
    })

    const output = fs
      .createWriteStream(`${process.cwd()}/${config.distPath}.zip`)
      .on('close', (e) => {
        if (e) {
          error(`打包zip出错: ${e}`)
          reject(e)
          process.exit(1)
        } else {
          succeed(`${underline(`${config.distPath}.zip`)} 打包成功`)
          resolve()
        }
      })

    archive.pipe(output)
    archive.directory(config.distPath, false)
    archive.finalize()
  })
}

// 连接ssh
const connectSSH = async (config, index) => {
  try {
    log(`(${index}) ssh连接 ${underline(config.host)}`)

    const { privateKey, passphrase, password } = config
    if (!privateKey && !password) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: '请输入服务器密码'
        }
      ])

      config.password = answers.password
    }

    !privateKey && delete config.privateKey
    !passphrase && delete config.passphrase

    await ssh.connect(config)
    succeed('ssh连接成功')
  } catch (e) {
    error(e)
    process.exit(1)
  }
}

// 上传本地文件
const uploadLocalFile = async (config, index) => {
  try {
    const localFileName = `${config.distPath}.zip`
    const remoteFileName = `${config.webDir}.zip`
    const localPath = `${process.cwd()}/${localFileName}`

    log(`(${index}) 上传打包zip至目录 ${underline(remoteFileName)}`)

    const spinner = ora('正在上传中\n')

    spinner.start()

    await ssh.putFile(localPath, remoteFileName, null, {
      concurrency: 1
    })

    spinner.stop()
    succeed('上传成功')
  } catch (e) {
    error(`上传失败: ${e}`)
    process.exit(1)
  }
}

// 备份远程文件（备份/删除/解压全都包含了）
const backupRemoteFile = async (config, index) => {
  try {
    const { windowsPath, bakDir } = config;
    const dirName = 'dist';
    const zipFileName = `${dirName}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.zip`;
    console.log(`(${index}) 备份远程文件 ${underline(windowsPath)}`);
    const destination = `${bakDir}${zipFileName}`;
    //单备份
    //await ssh.execCommand(`cmd /c "cd /d ${windowsPath} && powershell -command "Compress-Archive -Path ${windowsPath}\\* -DestinationPath ${destination}"`);
    //备份+删除
    //await ssh.execCommand(`cmd /c "cd /d ${windowsPath} && powershell -command \"Compress-Archive -Path '${windowsPath}\\*' -DestinationPath '${destination}'; Get-ChildItem -Path . -Exclude 'dist.zip' | Remove-Item -Recurse -Force\""`);
    //备份删除解压
    await ssh.execCommand(`cmd /c "cd /d ${windowsPath} && powershell -command \"Compress-Archive -Path '${windowsPath}\\*' -DestinationPath '${destination}'; Get-ChildItem -Path . -Exclude 'dist.zip' | Remove-Item -Recurse -Force; Expand-Archive -Path 'dist.zip' -DestinationPath .; Remove-Item -Path 'dist.zip' -Force\""`);
    succeed('备份成功')
    console.log(`备份成功 备份至 ${underline(`${bakDir}\\${zipFileName}`)}，且原文件已被删除`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};



// 删除远程文件
const removeRemoteFile = async (config, index) => {
  try {
    const { windowsPath } = config
    const remoteFileName = `${windowsPath}dist.zip`

    log(`(${index}) 删除远程文件 ${underline(remoteFileName)}`)

    succeed('删除成功')
  } catch (e) {
    error(e)
    process.exit(1)
  }
}

// 解压远程文件
const unzipRemoteFile = async (config, index) => {
  try {
    const { windowsPath } = config
    const remoteFileName = 'dist.zip'

    log(`(${index}) 解压远程文件 ${underline(remoteFileName)}`)
    // 使用PowerShell命令进行解压
    //await ssh.execCommand(`cmd /c "cd /d ${windowsPath} && powershell -command \"Get-ChildItem -Path . -Exclude 'dist.zip' | Remove-Item -Recurse -Force\""`);
    //await ssh.execCommand(`cmd /c "cd /d ${windowsPath} && powershell -command \"Expand-Archive -Path '${remoteFileName}' -DestinationPath .; Remove-Item '${remoteFileName}' -Force\""`);
    //await ssh.execCommand(`cmd /c "cd /d ${windowsPath} && powershell -command \"Expand-Archive -Path 'dist.zip' -DestinationPath . ""`);
    //await ssh.execCommand(`cmd /c "cd /d ${windowsPath} && powershell -command \"Expand-Archive -Path 'dist.zip' -DestinationPath .; Remove-Item -Path 'dist.zip' -Force\""`);
    succeed('解压成功')

  } catch (e) {
    error(e)
    process.exit(1)
  }
}

// 删除本地打包文件
const removeLocalFile = (config, index) => {
  const localPath = `${process.cwd()}/${config.distPath}`

  log(`(${index}) 删除本地打包目录 ${underline(localPath)}`)

  const remove = (path) => {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        let currentPath = `${path}/${file}`
        if (fs.statSync(currentPath).isDirectory()) {
          remove(currentPath)
        } else {
          fs.unlinkSync(currentPath)
        }
      })
      fs.rmdirSync(path)
    }
  }

  remove(localPath)
  fs.unlinkSync(`${localPath}.zip`)
  succeed('删除本地打包目录成功')
}

// 断开ssh
const disconnectSSH = () => {
  ssh.dispose()
}

// 创建任务列表
const createTaskList = (config) => {
  const {
    script,
    bakDir,
    isRemoveRemoteFile = true,
    isRemoveLocalFile = true
  } = config

  taskList = []
  script && taskList.push(execBuild)
  taskList.push(buildZip)
  taskList.push(connectSSH)
  taskList.push(uploadLocalFile)
  bakDir && taskList.push(backupRemoteFile)
  //taskList.push(unzipRemoteFile)
  isRemoveRemoteFile && taskList.push(removeRemoteFile)
  isRemoveLocalFile && taskList.push(removeLocalFile)
  taskList.push(disconnectSSH)
}

// 执行任务列表
const executeTaskList = async (config) => {
  for (const [index, execute] of new Map(
    taskList.map((execute, index) => [index, execute])
  )) {
    await execute(config, index + 1)
  }
}

module.exports = {
  description: '部署项目',
  apply: async (env) => {
    if (checkDeployConfigExists(deployConfigPath)) {
      const config = (await import(pathToFileURL(deployConfigPath))).default
      const cluster = config.cluster
      const projectName = config.projectName
      const currentTime = new Date().getTime()

      const createdEnvConfig = (env) => {
        checkEnvCorrect(config, env)

        return Object.assign(config[env], {
          privateKey: config.privateKey,
          passphrase: config.passphrase,
          readyTimeout: config.readyTimeout
        })
      }

      if (env) {
        const envConfig = createdEnvConfig(env)

        const answers = await confirmDeploy(
          `${underline(projectName)} 项目是否部署到 ${underline(
            envConfig.name
          )}?`
        )

        if (answers.confirm) {
          createTaskList(envConfig)

          await executeTaskList(envConfig)

          succeed(
            `恭喜您，${underline(projectName)}项目已在${underline(
              envConfig.name
            )}部署成功 耗时${(new Date().getTime() - currentTime) / 1000}s\n`
          )
          process.exit(0)
        } else {
          process.exit(1)
        }
      } else if (cluster && cluster.length > 0) {
        const answers = await confirmDeploy(
          `${underline(projectName)} 项目是否部署到 ${underline('集群环境')}?`
        )

        if (answers.confirm) {
          for (const env of cluster) {
            const envConfig = createdEnvConfig(env)

            createTaskList(envConfig)

            await executeTaskList(envConfig)

            succeed(
              `恭喜您，${underline(projectName)}项目已在${underline(
                envConfig.name
              )}部署成功`
            )
          }

          succeed(
            `恭喜您，${underline(projectName)}项目已在${underline(
              '集群环境'
            )}部署成功 耗时${(new Date().getTime() - currentTime) / 1000}s\n`
          )
        } else {
          process.exit(1)
        }
      } else {
        error(
          '请使用 deploy-cli-win-service -mode 指定部署环境或在配置文件中指定 cluster（集群）地址'
        )
        process.exit(1)
      }
    } else {
      error(
        `${getDeployConfigFileName()} 文件不存，请使用 deploy-cli-win-service init 命令创建`
      )
      process.exit(1)
    }
  }
}
