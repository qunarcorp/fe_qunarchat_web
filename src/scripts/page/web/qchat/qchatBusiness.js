/*
 * @Author: nengting.jiang
 * @Date:   20170120
 * @Last Modified by:nengting.jiang
 * @Last Modified time:20170120
 * @Description 对外接口(web)
 */


if (typeof window.QCHAT == "undefined") {
	window.QCHAT = {};
};


window.QCHAT.Business = {

	init: function() {
		//初始化聊天框，保存dom
	},

	trigger: function(msg, type, args) {
		//当点击了预置消息类型，调用business接口通知
	}
};

window.QCHAT.Business.init();