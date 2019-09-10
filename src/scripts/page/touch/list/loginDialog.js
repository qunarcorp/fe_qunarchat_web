/*
 * @Author: heng.xu
 * @Date:   2016/1/9 14:20
 * @Last Modified by:   
 * @Last Modified time: 
 * @Description 
 */

require("jp/jquery.cookie.js");
var Dialog = function(){

    var instance = this;
    this.utils = require("utils/utils_touch.js").utils;
    this.projectName = 'qchat';

    Dialog = function(){
        return instance;
    }

    Dialog.prototype = this;
    instance = new Dialog();
    instance.constructor = Dialog;
    instance.createTime = new Date();

    return instance;

}

Dialog.prototype = {

    init: function(loginCallback) {
        this.loginCallback=loginCallback;
        this.load();
    },

    load: function() {

        var qcookie = $.cookie("_q"),
            tcookie = $.cookie("_t");

        if (!!qcookie && !!tcookie) {
            if (this.loginCallback) {
                this.loginCallback();
            }

        } else {
            this.loginCallback();
            // this.reLogin();
        }
    },
    refresh:function(){
        setTimeout(function () {
            var qcookie = $.cookie("_q"),
                tcookie = $.cookie("_t");

            if (!!qcookie && !!tcookie) {
                if (this.loginCallback) {
                    this.loginCallback();
                }
            }else{
                this.refresh();
            }
        }.bind(this), 1000);
    },

    // 需使用者提供接口,跳转到登录页面
    reLogin: function(){
        window.location.href = "";
    }

};
module.exports=new Dialog();
