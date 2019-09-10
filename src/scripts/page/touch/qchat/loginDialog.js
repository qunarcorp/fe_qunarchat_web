require("jp/jquery.cookie.js");
var Dialog = function () {

    var instance = this;
    this.utils = require("utils/utils_touch.js").utils;
    this.projectName = 'qchat';

    Dialog = function () {
        return instance;
    }

    Dialog.prototype = this;
    instance = new Dialog();
    instance.constructor = Dialog;
    instance.createTime = new Date();

    return instance;

}

Dialog.prototype = {

    run: function (loginCallback) {
        this.loginCallback = loginCallback || this.loginCallback;
        this.load();
    },

    isLogin: function () {
        var qcookie = $.cookie("_q"),
            tcookie = $.cookie("_t");

        return !!qcookie && !!tcookie;
    },

    load: function () {
        // 需使用者提供接口,跳转到登录页面
        // if (this.isLogin()) {
        //     this.loginCallback && this.loginCallback();
        // } else {
        //     window.location.href = "";
        // }
        this.loginCallback && this.loginCallback();
    },
    refresh: function () {
        var self = this;
        setTimeout(function () {
            if (self.isLogin()) {
                if (this.loginCallback) {
                    this.loginCallback();
                }
            } else {
                this.refresh();
            }
        }.bind(this), 1000);
    }
};
module.exports = new Dialog();