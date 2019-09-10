var patterns = {
    // 这里匹配是否符合tts detail url 格式
    detailUrl: false,
    idParam: /^id=\d+$/
}

var msgType = {
    emoi: /type=["|']emoticon["|']/g,
    image: /type=["|']image["|']/g,
    file: /FILEID/g,
}

var handler = {
    checkWishId: function(message, wishId) {
        if(message.match(patterns.detailUrl)) {
            var result = handler.rewriteUrlArgs(handler.removeHash(message))
            var args = result[1];
            // 统计参数
            // 移动平台用it
            args.push('it=' + wishId)
            // pc平台使用tm
            var hash = '#tm=' + wishId;

            return result[0] + '?' + args.join('&') + hash;
        }

        return message;
    },
    // 去掉hash
    removeHash: function(message) {
        var hashPoi = message.indexOf('#');
        if(hashPoi === -1) {
            return message;
        }

        return message.slice(0, hashPoi);
    },
    // 去掉不相干的参数 只保留id; id=1313213?*** 模式下没有id参数，直接写在了path里
    rewriteUrlArgs: function(msg) {
        message = msg.replace(/\&amp;/g, "&")
            .replace(/&lt;/g,  "<")
            .replace(/&gt;/g,  ">")
            .replace(/&apos;/g,  "'")
            .replace(/&quot;/g,  "\"");

        var urlParts = message.split('?');
        var params = urlParts[1];
        var args = []

        // 没有参数
        if(!params) {
            return [urlParts[0], args];
        }

        var paramArr = params.split('&');

        for(var i = 0, len = paramArr.length; i < len; i++) {
            if(patterns.idParam.test(paramArr[i])) {
                args.push(paramArr[i]);
            }
        }

        return [urlParts[0], args];
    },
    getMsgType: function(msg) {
        if(msgType.emoi.test(msg)) {
            return ['emoi', '发来了一个表情'];
        } else if(msgType.image.test(msg)) {
            return ['image', '发来了一张图片'];
        } else if(msgType.file.test(msg)) {
            return ['file', '发来了一个文件'];
        } else {
            return ['message', msg]
        }
    }
}

module.exports = handler;