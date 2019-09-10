var utils = require('utils/utils.js');

var login = {
    run: function(loginCallback) {
        // run模块检查了是否登陆，能执行到这里一定是登陆成功了
        loginCallback();
    },
    setOptions: function(params) {
        this.params = params || {};
        if(!params.isUCenter && (!params.busiLoginId || !params.busiLoginType)) {
            throw new Error('请配置busiLoginType和busiLoginId');
            return;
        }

        return this;
    },
    isUCenterLogin: function() {
        return this.params.isUCenter;
    },
    getTokenData: function() {
        return {
            type: this.params.busiLoginType,
            currentId: this.params.busiLoginId
        };
    }
};

module.exports = login;
