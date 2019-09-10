/**
 * @Author: wanghaowh.wang
 * @Date:   2017-11-02T17:46:34+08:00
 * @Filename: helloMsg.js
 * @Last modified by:   wanghaowh.wang
 * @Last modified time: 2017-11-02T17:46:35+08:00
 * @Description:  请求欢迎语接口
 * 暂无提供接口
 */

'use strict';

function sayHello(config) {
    return $.ajax({
        url: '',
        type: 'POST',
        dataType: 'jsonp',
        data: {
            seatQName: config.from,
            userQName: config.to,
            line: config.line,
            seatId: config.seatId,
            virtualId: config.virtualId,
            seatHost: config.seatHost || window.nav_igator.baseaddess.domain
        },
        jsonp: 'callback'
    });
}

module.exports = sayHello;