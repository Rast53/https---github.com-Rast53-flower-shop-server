const AWS = require('aws-sdk');

// Явно указываем версию SDK
AWS.config.update({
  endpoint: 'https://storage.yandexcloud.net',
  accessKeyId: process.env.YANDEX_ACCESS_KEY,
  secretAccessKey: process.env.YANDEX_SECRET_KEY,
  region: 'ru-central1',
  httpOptions: {
    timeout: 10000,
    connectTimeout: 10000
  }
});

const s3 = new AWS.S3();

module.exports = s3;