/*
 * @Author: nengting.jiang
 * @Date:   20170120
 * @Last Modified by:   wanghaowh.wang
 * @Last Modified time: 2017-05-12 15:46:03
 * @Description  业务线消息处理
 *   消息类型：酒店问题消息、账单消息(web)、机器人回答消息、转接消息
 *   酒店问题消息、账单消息(web)
 *   获取转移会话消息内容
 */

//常见问题模板
require("tmpl/web/tmpl4000.mustache");
//结算模板
require("tmpl/web/tmpl4001.mustache");
//机器人回答消息
require("tmpl/web/tmpl4002.mustache");

var businessMessage = {

	init: function() {
		this.$page = $(document);
		this.initEvent();
	},

	initEvent: function() {
		var self = this;

		//常见问题列表：每个问题点击事件
		this.$page.on("click", ".js-faq-item", function(e) {

			var msg = $(this).attr("data-title") || "";
			var url = $(this).attr("data-url") || "";

			if (msg) {
				window.QCHAT.sendMsg(msg, 4000);
			};

			if (url) {
				self.sendAjax(url);
			}
		});

		//请先选择您遇到问题：每个问题点击事件
		this.$page.on("click", ".item", function(e) {

			var url = $(this).attr("data-url") || "";

			if (url) {
				self.sendAjax(url);
			}
		});

		//4002 没有解答您的问题 点击事件 class和第三方确定的对方写死
		this.$page.on("click", ".js-request", function(e) {

			var $t = $(this).parent();

			var url = $t.length && $t.attr("data-url") || "";

			if (url) {
				console.log(url);
				self.sendAjax(url);
			}
		});


	},

	/*
	 * 发送请求给后端
	 */
	sendAjax: function(url) {
		$.ajax({
			url: url,
			type: 'GET',
			dataType: 'jsonp',
			//jsonp: 'callback',			
			success: function(data) {},
			error: function(data) {}
		});
	},

	/*
	 * 获取业务线扩展的消息内容
	 * data 
	 * msgType
	 * isMe
	 */
	getMsgHtml: function(data, msgType, isMe) {
		var result = "";
		msgType = parseInt(msgType, 10);
		switch (msgType) {
			//问题列表消息
			case 4000:
				result = this.getTmpl4000(data);
				break;
				//账单消息
			case 4001:
				result = this.getTmpl4001(data, isMe);
				break;
				//转移会话消息
			case 1001:
				result = this.getMessage1001(data);
				break;
				//机器人回答消息
			case 4002:
				result = this.getTmpl4002(data);
				break;
				//转接消息
			case 4003:
				result = this.getTmpl4003(data);
				break;
		}
		return result;
	},

	/*
	 * 获取转移会话消息内容
	 * AClient 在转移给webChat转接消息 consult
	 */
	getMessage1001: function(data) {

		// {
		//     "TransReson": "test 转移", "realtoId": "laserhenry", "toId":"虚拟id","realfromIdNickName":"","realtoIdNickName":""
		// }

		if (!data) {
			return "";
		}

		if (typeof data === 'string') {
			data = JSON.parse(data);
		};

		var content = (data.realfromIdNickName || "") + " 将会话转移给了 " + (data.realtoIdNickName || "");

		var result = {
			title: content,
			info: '',
			consultName: data.realtoIdNickName,
			consultId: data.realtoId,
			shopId: data.toId && data.toId.split('@')[0] || ''
		};

		return result;
	},

	getObjectByText: function(jsonText) {
		if (!jsonText) {
			return "";
		};
		return JSON.parse(jsonText);
	},

	/*
	 * 获取转接消息
	 */
	getTmpl4003: function(data) {

		if (!data) {
			return "";
		}

		if (typeof data === 'string') {
			data = JSON.parse(data);
		};

		var result = {
			title: data.title || '',
			info: ''
		};

		return result;
	},

	/*
	 * 机器人回答消息
	 */
	getTmpl4002: function(data) {

		if (!data) {
			return "";
		}

		if (typeof data === 'string') {
			data = JSON.parse(data);
		};


		if (!data || !data.data) {
			return "";
		};

		var info = QTMPL.tmpl4002.render({
			datas: data
		});

		var result = {
			title: data.title || '',
			info: info
		};

		return result;
	},

	/*
	 * 获取结算列表HTML结构内容
	 */
	getTmpl4001: function(data, isMe) {

		if (!data) {
			return "";
		}

		if (typeof data === 'string') {
			data = JSON.parse(data);
		};

		if (!data || !data.data) {
			return "";
		};

		//增加查看更多标记
		var len = data.data.length || 0;
		var actionType = 0; //更多
		for (var i = 0; i < len; i++) {
			actionType = data.data[i].actionType;
			data.data[i].isMore = false;
			if (actionType == 2) {
				data.data[i].isMore = true;
			}
		};
		//是否为一条记录,如果一条记录就不显示底部线条
		var isOneRow = true;
		if (len > 1) {
			isOneRow = false;
		};

		var info = QTMPL.tmpl4001.render({
			datas: data,
			isMe: isMe,
			isOneRow: isOneRow
		});

		var result = {
			title: data.title || '',
			info: info
		};

		return result;
	},

	/*
	 * 获取常见问题列表HTML结构内容
	 */
	getTmpl4000: function(data) {
		if (!data) {
			return "";
		}

		if (typeof data === 'string') {
			data = JSON.parse(data);
		};


		if (!data || !data.data) {
			return "";
		};

		var info = QTMPL.tmpl4000.render({
			datas: data
		});

		var result = {
			title: data.title || '',
			info: info
		};

		return result;
	}
};

module.exports = businessMessage;