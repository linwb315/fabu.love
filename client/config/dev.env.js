'use strict'
const merge = require('webpack-merge')
const prodEnv = require('./prod.env')


// ��������ʱserver�˵ĵ�ַ
var devServerHost = '"http://127.0.0.1:9898"'

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  SERVER_HOST: devServerHost
})
