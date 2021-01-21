'use strict'
const merge = require('webpack-merge')


// ��ʽ��������ʱserver�˵ĵ�ַ ,����ʹ�û�����������
// ���δ���û�������,��ʹ��������ĵ�ǰ�����host��Ϊ��������ַ
var productServerHost = process.env.SERVER_HOST
var allowRegister = process.env.FABU_ALLOW_REGISTER || true // �Ƿ������û�ע��,Ϊ������ע��ӿڲ�����



var config = {
  'ALLOW_REGISTER': allowRegister
}

if (productServerHost) {
  config['SERVER_HOST'] = productServerHost
}

module.exports = merge({
  NODE_ENV: '"production"'
}, config)
