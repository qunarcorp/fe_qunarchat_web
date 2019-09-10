/*
 * @Author: baotong.wang
 * @Date: 2017-02-17 19:34:42
 * @Last Modified by: baotong.wang
 * @Last Modified time: 2017-05-24 16:29:22
 * @Description: 发送图片、文件的上传控制
 * @Dependence: 基于jquery，jquery.fileupload.js
 */

require('lib/upload/jquery.iframe.transport.js');
require('lib/upload/jquery.fileupload.js');
require('jp/jquery.md5.js');
require('lib/extension/date.js');
require('lib/extension/string.js');

var MsgHelper = require('./messageHelper.js');
var utils = require('utils/utils.js');
var Enums = require('../enums.js');

var upload = {
    setOptions: function(args) {
        var noExist = 'qchat_noUpload';

        this.converse = args.converse;
        this.domain = args.domain;
        if(args.sendImageId) {
            this.$imageUpload = $('#' + args.sendImageId);
        } else if(args.sendImageClass) {
            this.$imageUpload = $('.' + args.sendImageClass);
        }

        if(args.sendFileId) {
            this.$fileUpload = $('#' + args.sendFileId);
        } else if(args.sendFileClass) {
            this.$fileUpload = $('.' + args.sendFileClass);
        }

        this.onUploadStart = args.onUploadStart || utils.getEmptyFunc();
        this.onUploadProgress = args.onUploadProgress || utils.getEmptyFunc();
        this.onUploadDone = args.onUploadDone || utils.getEmptyFunc();
        this.showMessage = args.showMessage || utils.getEmptyFunc();
        this.limitFileSize = 1024 * 1024 * 50; // 50M;

        this.init();
    },
    init: function() {
        var self = this;

        this.$imageUpload && this.$imageUpload.length && this.$imageUpload.on('click', function() {
            self.uploadImage.call(self);
        });
        this.$fileUpload && this.$fileUpload.length && this.$fileUpload.on('click', function() {
            self.uploadFile.call(self);
        });
    },
    uploadImage: function() {
        var self = this;

        var u = this.converse.settings.get('myName');
        var k = this.converse.settings.get('key');
        var url = this.domain + '/file/v2/upload/img?size=48&u=' + u + '&k=' + k + '&key=test';

        var uploadCBData = {
            sender: Enums.SendType.ME,
            from: u,
            to: this.converse.getCurrentStrid(),
            msgType: Enums.MsgTypes.NORMAL,
            time: new Date().format('MM-dd hh:mm:ss'),
            username: u,
            imageUrl: this.converse.settings.get('myImage') || ''
        };

        var sendImageMsg = function(imageUrl) {
            var localImg = new Image();

            localImg.src = imageUrl;

            var sendMsg = function(img) {
                var msg = '[obj type="image" value="{0}" width={1} height={2} ]'.format(imageUrl, img.width, img.height);
                var status = self.converse.sendMessage(msg);

                uploadCBData.message = MsgHelper.decode(msg);
                uploadCBData.time = new Date().format('MM-dd hh:mm:ss');
                status && self.showMessage([uploadCBData]);
            };

            if(localImg.complete) {
                sendMsg(localImg);
            } else {
                localImg.onload = function() {
                    sendMsg(localImg);
                };
            }
        };

        this.$imageUpload.fileupload({
            url: url,
            dropZone: false,
            dataType: 'json',
            autoUpload: false,
            forceIframeTransport: false,
            limitMultiFileUploadSize: 1024 * 1024 * 50, // 50M
            add: function(e, data) {
                data.process().done(function() {
                    $.each(data.files, function(index, file) {
                        var key = $.md5(utils.createUUID()); // $.md5(file.name);
                        var sizeMB = utils.bytesToMB(file.size);
                        var paramLink = 'name=' + file.name + '&size=' + sizeMB + '&u=' + u + '&k=' + k + '&key=' + key + '&p=qim_web';
                        var url = self.domain + '/file/v2/upload/img?' + paramLink;

                        if (file.size > self.limitFileSize) {
                            alert('图片大小不能超过50M');
                            return;
                        }

                        // 设置新的提交地址
                        data.setSubmitURL(url);

                        // 校验上传的文件是否存在
                        // 如果文件存在了就不上传了，直接显示为和上传成功的效果
                        var checkFileUrl = self.domain + 'file/v2/inspection/img?' + paramLink;

                        self.checkUpLoadFileExist(checkFileUrl, function(resp) {
                            uploadCBData.message = file.name;
                            self.onUploadStart(uploadCBData);

                            // 文件不存在
                            if (resp.ret) {
                                // 提交上传文件
                                data.submit();
                            } else {
                                // 文件已存在了直接显示上传成功效果
                                var serverUrl = resp.data; // 存在的文件URL地址

                                self.onUploadDone(serverUrl);
                                sendImageMsg(serverUrl);
                            }
                        });
                    });
                });
            },
            done: function(e, data) {
                var serverUrl = data.result.data;

                self.onUploadDone(serverUrl);
                sendImageMsg(serverUrl);
            },
            progress: function(e, data) {
                self.onUploadProgress(data.loaded, parseInt(data.loaded / data.total * 100, 10));
            }
        });
    },
    uploadFile: function() {
        var self = this;
        var u = this.converse.settings.get('myName');
        var k = this.converse.settings.get('key');
        var url = this.domain + '/file?size=46&u=' + u + '&k=' + k + '&key=1234';

        var uploadCBData = {
            sender: Enums.SendType.ME,
            time: new Date().format('MM-dd hh:mm:ss'),
            username: u,
            imageUrl: this.converse.settings.get('myImage') || '',
            msgType: Enums.MsgTypes.FILE,
            from: u,
            to: this.converse.getCurrentStrid()
        };

        var sendFileMsg = function(fileName, fileSize, serverUrl) {
            var msg = JSON.stringify({
                'FILEID': new Date().getTime(),
                'FILEMD5': '123',
                'FileName': fileName,
                'FileSize': utils.bytesToSize(fileSize),
                'HttpUrl': serverUrl
            });

            var status = self.converse.sendMessage(msg, Enums.MsgTypes.FILE);

            uploadCBData.time = new Date().format('MM-dd hh:mm:ss');
            uploadCBData.message = MsgHelper.decode(msg, Enums.MsgTypes.FILE);
            status && self.showMessage([uploadCBData]);
        };

        this.$fileUpload.fileupload({
            url: url,
            dropZone: undefined,
            forceIframeTransport: false,
            dataType: 'json',
            add: function(e, data) {
                data.process().done(function() {
                    $.each(data.files, function(index, file) {
                        var key = $.md5(utils.createUUID());
                        var sizeMB = utils.bytesToMB(file.size);
                        var paramLink = 'name=' + file.name + '&size=' + sizeMB + '&u=' + u + '&k=' + k + '&key=' + key + '&p=qim_web';
                        var url = self.domain + '/file/v2/upload/file?' + paramLink;

                        if (file.size > self.limitFileSize) {
                            alert('文件大小不能超过50M');
                            return;
                        }

                        // 设置新的提交地址
                        data.setSubmitURL(url);

                        // 校验上传的文件是否存在
                        // 如果文件存在了就不上传了，直接显示为和上传成功的效果
                        var checkFileUrl = self.domain + '/file/v2/inspection/file?' + paramLink;

                        self.checkUpLoadFileExist(checkFileUrl, function(resultData) {
                            uploadCBData.message = file.name;
                            self.onUploadStart(uploadCBData);

                            // 文件不存在
                            if (resultData.ret) {
                                // 提交上传文件
                                data.submit();
                            } else {
                                // 文件已存在了直接显示上传成功效果
                                var serverUrl = resultData.data; // 存在的文件URL地址

                                self.onUploadDone(serverUrl);

                                sendFileMsg(file.name, file.size, serverUrl);
                            }
                        });
                    });
                });
            },
            done: function(e, data) {
                var serverUrl = data.result.data;

                if (data && data.files && data.files.length > 0) {
                    self.onUploadDone(serverUrl);

                    var file = data.files[0];

                    sendFileMsg(file.name, file.size, serverUrl);
                } else {
                    self.onUploadDone(null);
                }
            },
            progress: function(e, data) {
                self.onUploadProgress(data.loaded, parseInt(data.loaded / data.total * 100, 10));
            }
        });
    },
    // 校验上传文件是否已存在了
    checkUpLoadFileExist: function(url, callback) {
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            data: {},
            jsonp: 'callback',
            success: function(data) {
                // true代表文件不存在，可以上传
                callback && callback(data);
            },
            error: function() {}
        });
    }
};

module.exports = upload;
