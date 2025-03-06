const multer = require('multer');
   const multerS3 = require('multer-s3');
   const s3 = require('../config/s3');

   const uploadImage = multer({
     storage: multerS3({
       s3: s3,
       bucket: process.env.YANDEX_BUCKET_NAME,
       acl: 'public-read',
       contentType: multerS3.AUTO_CONTENT_TYPE,
       key: function (req, file, cb) {
         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
         const extension = file.originalname.split('.').pop();
         cb(null, `flowers/${uniqueSuffix}.${extension}`);
       }
     })
   });

   module.exports = uploadImage;