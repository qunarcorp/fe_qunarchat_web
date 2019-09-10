require("jp/jquery.cookie.js");
var Dialog = function() {

    var instance = this;
    this.projectName = 'qchat';

    Dialog = function() {
        return instance;
    }

    Dialog.prototype = this;
    instance = new Dialog();
    instance.constructor = Dialog;
    instance.createTime = new Date();

    return instance;

}

Dialog.prototype = {

    run: function(loginCallback) {
        this.loginCallback = loginCallback || this.loginCallback;
        this.load();
    },

    /*
     * 判断是否已登录了
     */
    isLogin: function() {
     
        var qcookie = $.cookie("_q"),
            tcookie = $.cookie("_t"),
            qn42 = $.cookie("QN42"),
            self = this;

        //有值
        if (!!qcookie && !!tcookie && !!qn42) {
            return true;
        } else {
            return false;
        }
    },
    load: function() {
        // var self = this;
        // 暂无提供接口,没有登录时跳转
        if (this.isLogin()) { 
            this.loginCallback && this.loginCallback();
        } else {
            var href = window.location.href;
            // 需使用者提供,登录页面接口
            window.location = ''+encodeURIComponent(href)
        }
    }
};
module.exports = new Dialog();