/*
 * @Author: baotong.wang
 * @Date: 2017-02-10 19:15:49
 * @Last Modified by: baotong.wang
 * @Last Modified time: 2017-05-24 16:55:07
 */

var enums = {
    MsgTypes: {
        NORMAL: 1,
        FILE: 5,
        SHAKE: 10,
        // NOTE: 'note',
        // END: 'end',
        // CLOSE: 'close',
        OCHAT: 32768,
        TRANSFER: 1001
    },
    OchatStatus: {
        END: 59,
        START: 60
    },
    TargetType: {
        QTALK: 1,
        QCHAT: 2
    },
    UploadType: {
        FILE: 1,
        IMAGE: 2
    },
    SendType: {
        ME: 'me',
        THEM: 'them'
    },
    _Domain: {
        QTALK: 'ejabhost1',
        QCHAT: 'ejabhost2'
    },
    ChatStatus: {
        // 不在线
        INACTIVE: 'inactive',
        // 在线
        ACTIVE: 'active',
        // 正在输入
        COMPOSING: 'composing',
        // 暂时离开
        PAUSED: 'paused',
        // 离开
        GONE: 'gone'
    }
};

window.QchatEnum = enums;

module.exports = enums;
