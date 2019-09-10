var msgHelper = require('./msgLogic.js');

var STATUS = {
    GRANTED: 'granted',
    DENIED: 'denied',
    DEFAULT: 'default'
}

var config = {
    storageKey: 'notification_checked_result',
    checkPass: '1',
    checkFail: '0'
}

function sendSK(name) {
    if(window.QNRSK && window.QNRSK.manual) {
        window.QNRSK.manual(name);
    }
}

function msgWrapper(original) {
    return msgHelper.getMsgType(original)[1];
}

function QMsgNotice() {
    var self = this;
    this.Notification = window.Notification || window.webkitNotifications || false;

    if (!this.Notification) {
        return;
    }

    this.permissionPromsie = this.checkPermission();
    
    this.permissionPromsie && this.permissionPromsie.then(function() {
        localStorage.setItem(config.storageKey, config.checkPass);
        self.isFocus = true;
        
        window.onfocus = function () {
            self.isFocus = true;
        }
    
        window.onblur = function () {
            self.isFocus = false;
        }
    }).catch(function(){ 
        localStorage.setItem(config.storageKey, config.checkFail);
    });
}

QMsgNotice.prototype.checkPermission = function () {
    var isCheck = localStorage.getItem(config.storageKey);

    if(isCheck && typeof isCheck === 'string') {
        return isCheck === config.checkPass ? Promise.resolve() : Promise.reject();
    }

    try {
        switch (this.Notification.permission) {
            case STATUS.GRANTED:
                sendSK('Notifi_Inital_Granted');
                return Promise.resolve();
            case STATUS.DENIED:
                sendSK('Notifi_Inital_Denied');
                return Promise.reject();
            case STATUS.DEFAULT:
                return this.Notification.requestPermission().then(function (permission) {
                    if (permission === STATUS.GRANTED) {
                        sendSK('Notifi_Request_Granted');
                        return Promise.resolve();
                    } else {
                        sendSK('Notifi_Request_Denied');
                        return Promise.reject();
                    }
                })
        };
    } catch (e) {
        return null;
    }
}

QMsgNotice.prototype.showNotice = function (strid, msg, icon) {
    var self = this;
    var promise = this.permissionPromsie;

    if (!promise || this.isFocus === true) {
        return
    }
    
    promise.then(function () {
        var flag = true;

        var notice = new self.Notification(strid + '说：', {
            body: msgWrapper(msg),
            icon: icon
        })

        setTimeout(function () {
            flag && notice.close();
        }, 3e3);

        notice.onclick = function () {
            flag = false;
            sendSK('Notifi_User_Click');
        }

        notice.onclose = function () {
            sendSK('Notifi_Auto_Close');
        }
    }).catch(function () {
        // do nothing here
    })
}

module.exports = new QMsgNotice();