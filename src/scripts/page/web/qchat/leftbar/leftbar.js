require('lib/extension/string.js');
require('lib/extension/date.js');
require('./list_item.mustache');

var qchatCore = require("qchat/qchat-core.js"),
	Converse = qchatCore.converse;

var IS_DEBUG = false;

var config = {
	// 获取近期（10天）联系人及之间的未读消息数量，返回联系人 + 消息数量
	qchatUnreadList: '/package/qtapi/getrbl.qunar',
	// 获取联系人头像、基本信息等
	getQchatVCard: '/newapi/domain/get_vcard_info.qunar',
	// 重新分配客服
	getSeat: '/qcadmin/api/seat/judgmentOrRedistribution.json',
	domain: window.nav_igator.baseaddess.domain
}

var callbackList = {};
// 店铺昵称或者客服昵称
var cacheWebname = {};
//缓存店铺ID-->对应的客服ID
var cacheShopSeat = {};

//左边联系人缓存
var contactCacheList = {};

//缓存店铺基本信息shopId-->对应店铺昵称、店铺logo
var cacheShopBaseInfo = {};

var LeftBar = {
	init: function(args) {
		this.$container = $('#container');
		this.$leftBar = $('#leftbar');
		this.$list = this.$leftBar.find('ul');
		this.$toggleIcons = this.$leftBar.find('.toggle_icon');
		this.$unreadNum = this.$leftBar.find('.unread_num');
		this.$activeItem = null;
		this.selfName = args.myId;
		//判断不为空
		if ($.cookie('_q')) {
			this.selfName = $.trim($.cookie('_q').slice('2'));
		}

		//调用后端接口需要U=myId,K=key参数用于判断登录
		this.myId = args.myId;
		this.key = args.key;

		this.defaultStrid = args.defaultStrid;
		this.setting = args.setting;
		this.virtualId = args.setting.virtualId || ""; //虚拟ID

		this.activeId = this.virtualId || this.defaultStrid || '';

		this.myId = args.myId;
		this.key = args.key;


		this.getStridContainerCallback = args.getStridContainer || false;

		this.stridContainer = []; //联系人列表

		this.loadingContact();
		this.initEvent();
	},
	callbackType: {
		switchContact: 'switchContact',
		updateUserInfo: 'updateUserInfo'
	},
	registe: function(type, callback) {
		if (typeof callback !== 'function') {
			//throw new Error('callback should be a function');
			return;
		}

		callbackList[type] = callbackList[type] || [];

		callbackList[type].push(callback);
	},

	initEvent: function() {
		var self = this;

		this.$leftBar.on('click', '.switcher', function() {
			self.$container.toggleClass('lb_close').toggleClass('lb_open');
			self.$toggleIcons.toggleClass('hide');

			//校验左边列表关闭时显示未读数量
			self.checkLeftBarCloseShowUnread();
		});


		this.$list.on('click', '.qchat-item', function() {
			var $item = $(this),
				strid = $item.attr('id'),
				isShop = $item.attr('data-shop'),
				host = $item.attr('data-host');

			//自已
			if (strid === self.activeId) {
				return;
			}

			self.activeId = strid;
			self.$activeItem = $item;
			self.$list.find('.active').removeClass('active');

			$item.addClass('active').find('.item-unread').addClass('hide');

			var unreadCount = contactCacheList[self.activeId][0].unread || 0;
			
			if (self.totalUnread >= unreadCount) {
				self.totalUnread -= unreadCount;
			} else {
				self.totalUnread = 0;
			}

			if (self.totalUnread == 0) {
				//self.$unreadNum.remove();
				self.$unreadNum.addClass('hide');
			} else if (self.totalUnread < 99) {
				self.$unreadNum.text(self.totalUnread);
				self.$unreadNum.removeClass('hide');
			}

			//清除消息数量
			$item.find('.item-unread').text(0);
			contactCacheList[self.activeId][0].unread = 0;

			//增加了新的逻辑如果客服是店铺ID，需获取对应的客服ID
			//这时的店铺ID是虚拟ID
			var shopName = $item.data('shopname');
			Converse.setShopName(shopName || '');

			if (isShop == 1) {
				var _shopId = strid;

				//回调
				var callbackSwitchContact = function(_strid) {
					self.switchContact({
						strid: _strid,
						virtualId: _shopId,
						host: host,
						chatImage: $item.attr('data-bg'),
						webName:  cacheWebname[_strid] || '',
						shopName: shopName
					});
				};

				//根据店铺ID重新分配坐席（客服）
				if (!cacheShopSeat[_shopId]) {
					
					self.getSeat(_shopId, self.selfName, callbackSwitchContact);
				} else {
					callbackSwitchContact(cacheShopSeat[_shopId].strid);
				}

			} else {

				self.switchContact({
					strid: strid,
					host: host,
					virtualId: '',
					chatImage: $item.attr('data-bg'),
					webName: cacheWebname[strid]
				});
			}
		});
	},
	// 加载联系人列表
	loadingContact: function() {
		var self = this;

		$.ajax({
			url: config.qchatUnreadList,
			type: 'POST',
			dataType: 'json',
			contentType: 'application/json',
			xhrFields: {
                withCredentials: true
            },
            crossDomain: true,
			data: JSON.stringify({
				user: this.myId,
				domain: config.domain
			}),
			success: function(resp) {
				if (resp && resp.ret && resp.data) {
					// 显示联系人列表
					self.renderList(resp.data);
				} else {
					self.$list.html('<p class="empty">您暂时没有会话列表</p>');
				}
			},
			error: function(error) {
				self.$list.html('<p class="empty">您暂时没有会话列表</p>');
			}
		});
	},

	/*
	 * 根据店铺ID重新分配坐席（客服）
	 * 因为店铺ID是一个虚拟ID=to，需获取真实的客服=realto
	 * 参数：店铺id、用户名
	 * shopId,userQName
	 */
	getSeat: function(shopId, userQName, callback) {
		var self = this;
		//校验缓存是否已存在直接返回
		if (cacheShopSeat[shopId]) {
			callback && callback(cacheShopSeat[shopId].strid);
			return;
		};
		self.requestSeat(shopId, userQName).done(function(resp) {
			if (resp && resp.ret && resp.data) {
				var data = resp.data;
				var _strid = data.seat?data.seat.qunarName:undefined; //客服ID
				var webName = data.seat?data.seat.webName:undefined;

				//有客服在线
				if (data.onlineState == "online") {

					//跟据shopid,缓存对应的客服ID
					cacheShopSeat[shopId] = {
						strid: _strid
					};

					cacheWebname[_strid] = webName;

					//回调
					callback && callback(_strid, webName);
				} else {
					console.log("onlineState=", data.onlineState || "");
				}
			}
		});
	},
	requestSeat: function(shopId, userQName) {
		return $.ajax({
			url: config.getSeat,
			type: 'GET',
			data: {
				shopId: shopId,
				userQName: userQName
			},
			dataType: 'jsonp',
		});
	},

	/* 重新加载联系人列表 */
	leftBarReLoadContact: function() {
		this.loadingContact();
	},

	renderList: function(data) {
		var result = [],
			strids = [],
			activeItem,
			hasMatchId = false,
			hasDefaultStrid = this.defaultStrid !== '',
			virtualId = this.setting.virtualId;

		this.totalUnread = 0;

		for (var i = 0, item, contact; i < data.length; i++) {
			item = data[i];
			contactId = item.user; 
			contact = {
				contactId: contactId,
				contact: item.user,
				virtualId: '',
				host: item.host,
				unread: item.count || 0,
				isActive: false
			};

			if (hasMatchId === false) {
				hasMatchId = virtualId ? virtualId === item.user : this.defaultStrid === item.user;
			}

			if (!activeItem) {
				if (hasDefaultStrid && hasMatchId) {
					activeItem = contact;

					this.totalUnread += item.count - 0 || 0;
				}
			}

			//设置默认的虚拟ID
			if (this.virtualId == contactId) {
				contact.virtualId = this.virtualId;
				contact.contactId = this.virtualId;
				contact.realContactId = this.defaultStrid;
				contact.isShop = true;
				cacheShopSeat[this.virtualId] = {
					strid: this.defaultStrid
				};
			}

			this.stridContainer.push(contactId);

			contactCacheList[contactId] = contactCacheList[contactId] || [];
			contactCacheList[contactId].push(contact);

			result.push(contact);
			strids.push(item.user);
		}

		// 和列表中的都不匹配，那么新建一个联系人项
		if ((this.virtualId ||  hasDefaultStrid) && hasMatchId === false) {

			if (this.virtualId) {
				strids.push(this.virtualId);
				cacheShopSeat[this.virtualId] = {
					strid: this.defaultStrid
				};
				this.stridContainer.push(this.virtualId);
			}

			result.unshift({
				contactId: this.virtualId || this.defaultStrid,
				contact: this.defaultStrid,
				virtualId: self.virtualId,
				host: this.setting.toDomain,
				unread: false,
				isActive: true,
				isShop: this.virtualId ? true : false,
				realContactId: this.defaultStrid
			});

			contactCacheList[this.virtualId || this.defaultStrid] = contactCacheList[this.virtualId || this.defaultStrid] || [];
			contactCacheList[this.virtualId || this.defaultStrid].unshift({
				contactId: this.virtualId || this.defaultStrid,
				contact: this.defaultStrid,
				virtualId: self.virtualId,
				host: this.setting.toDomain,
				unread: 0,
				isActive: true,
				isShop: this.virtualId ? true : false
			});

			//默认第一个
			activeItem = result[0];
		}
		
		strids.indexOf(this.defaultStrid) === -1 && (strids.push(this.defaultStrid));
		this.getStridContainerCallback && this.getStridContainerCallback(this.stridContainer);

		// 没有未读也没有制定strid，默认第一个
		if (!activeItem) {
			if(result.length === 0) {
				return
			}

			activeItem = result[0];
		}

		activeItem.isActive = true;
		this.activeId = activeItem.contactId;
		this.activeHost = activeItem.host;
		//activeItem.contactId = activeItem.contact;
		//把当前活动的客服放到第一个位置
		this.initActiveInsertFirst(this.activeId, result);

		var listContent = QTMPL.list_item.render({
			list: result
		});

		this.$list.html(listContent);

		// 更新用户信息
		strids.length && this.updateUserInfo(strids);
		this.$activeItem = $('#' + this.activeId);

		//更新总的显示数量
		this.updateTotalUnread();
		this.switchContact({
			strid: activeItem.isShop ? activeItem.realContactId : this.activeId,
			virtualId: this.virtualId,
			host: this.activeHost,
			isShop: activeItem.isShop,
			shopName: activeItem.shopName
		}, true);
	},

	/*
	 * 把当前活动的客服放到第一个位置
	 */
	initActiveInsertFirst: function(activeId, result) {
		var key = activeId || '';
		var keyLocation = 0;
		var len = result.length || 0;
		//查找位置
		for (var i = 0; i < len; i++) {
			if (key == result[i].contactId) {
				keyLocation = i;
				break;
			}
		}
		//交换位置
		if (len > 0 && keyLocation > 0) {
			var tempItem = result[0];
			result[0] = result[keyLocation];
			result[keyLocation] = tempItem;
		};
	},

	/*
	 * 数组分组
	 * array 数组
	 * subGroupLength 数组数据的个数
	 */
	group: function(array, subGroupLength) {
		var index = 0;
		var newArray = [];
		while (index < array.length) {
			newArray.push(array.slice(index, index += subGroupLength));
		}
		return newArray;
	},

	/*
	 * 获取组合后的参数
	 */
	getGroupStrids: function(groupStrids) {
		var params = [];

		if (!groupStrids) {
			return params;
		}

		//组合参数
		var groupLen = groupStrids.length;

		for (var i = 0; i < groupLen; i++) {
			var subs = groupStrids[i];
			var users = [];
			var subLen = subs.length;
			for (var j = 0; j < subLen; j++) {
				users.push({
					user: subs[j],
					version: '0'
				});
			}
			params.push([{
				domain: this.setting.toDomain,
				users: users
			}]);
		}
		return params;
	},

	// 更新用户头像、显示名称
	updateUserInfo: function(strids) {
		// debugger

		var self = this;
		var args = [];
		if (!strids) {
			return;
		}

		//请求地址
		var requestURL = config.getQchatVCard + '?u=' + this.myId + '&k=' + this.key;

		//分组 10个数量一组
		var groupStrids = this.group(strids, 10);

		//获取组合后的请求参数
		var params = this.getGroupStrids(groupStrids);

		var virtualId = this.virtualId;

		//每次请求10个用户数据
		for (var i = 0, len = params.length; i < len; i++) {

			args = params[i];

			//统一使用一个接口
			$.ajax({
				url: requestURL,
				type: 'POST',
				dataType: 'json',
				contentType: 'application/json',
				data: JSON.stringify(args),
				success: function(resp) {
					if (resp && resp.ret && resp.data.length > 0) {
						var users = resp.data[0].users.length ? resp.data[0].users : null;

						if (!users) return;

						var $item = "",
							webname = "",
							username = "",
							imageurl = "",
							user = "",
							curShopName = '',
							curUserName = '';

						for (var u = 0, len = users.length; u < len; u++) {							
							user = users[u];

							if (!user) break;

							var $item = self.getNode(user.username);
							if ($item && $item.length) {
								if (user.webname) {
									$item.attr('data-webname', user.webname).find('.webname').html(user.webname);
								}
								if (user.imageurl) {
									$item.attr('data-bg', user.imageurl).find('.item-img').css({
										// 'background-image': 'url(' + window.nav_igator.baseaddess.fileurl + '/' + user.imageurl + ')'
										'background-image': 'url(' + user.imageurl + ')'
									});
								}
							}

							username = user.username || '';
							webname =  user.webname || user.nickname || username || '';
							imageurl = user.imageurl || '';

							// 缓存webname
							cacheWebname[username] = webname;

							var baseInfo = {
								'userName': username,
								'webName': webname,
								'imageUrl': imageurl,
								'isShop': false,
								'virtualId': virtualId
							};

							//默认客服有strid和shopid需显示店铺名称
							if (virtualId === username) {
								curShopName = webname;
								Converse.setShopName(webname);
							} else if (self.defaultStrid === username) {
								curUserName = webname;
							}
							
							if (user.type === '4') {
								baseInfo.isShop = true;
							}
							self.renderShopInfo(baseInfo);
						} //end for

						// 更新聊天框的shopname， webname
						callbackList[self.callbackType.updateUserInfo][0](curShopName, curUserName);
					} //end if 
				},
				error: function(error) {}
			});
		}
	},

	/**
	 * 渲染店铺信息
	 */
	renderShopInfo: function(dataInfo) {
		// debugger
		var self = this;

		if (!dataInfo) {
			return;
		}

		// var shopBaseInfo = {
		// 	'shopId': shopId,
		// 	'userName': username,
		// 	'shopName': nickname,
		// 	'imageUrl': imageurl,
		// 	'isShop': true
		// };

		var username = dataInfo.userName || '';
		var webname = dataInfo.webName || username || '';
		var imageurl = dataInfo.imageUrl || '';
		var virtualId = dataInfo.virtualId || '';

		$item = self.getNode(virtualId);

		if ($item && $item.length) {

			//如果是店铺类型需显示店铺名称 type==4
			if (dataInfo.isShop) {
				webname = dataInfo.shopName || webname;
				// $item.attr('data-shop', "1"); //店铺类型(1:是,0:否)
				// $item.attr('data-shopname', webname);
				$item.attr({
					'data-shop': 1,
					'data-shopname': webname
				});

			};

			if (username) {
				$item.attr('data-webname', username).find('.webname').html(webname);
			}
			if (imageurl) {
				$item.attr('data-bg', imageurl).find('.item-img').css({
					'background-image': 'url(' + imageurl + ')'
				});
			}

		} //end if 
	},

	/*
	 * 获取店铺基本信息
	 */
	getShopBaseInfo: function(shopId, callback) {

		//校验缓存店铺信息
		if (cacheShopBaseInfo[shopId]) {
			callback && callback(cacheShopBaseInfo[shopId]);
			return;
		}

		//请求地址
		var requestURL = config.getQchatVCard + '?u=' + this.myId + '&k=' + this.key;

		//传shopid就返回店铺信息
		var args = [{
			domain: this.setting.toDomain,
			users: [{
				user: shopId,
				version: '0'
			}]
		}];

		var self = this;

		//统一使用一个接口
		$.ajax({
			url: requestURL,
			type: 'POST',
			dataType: 'json',
			data: JSON.stringify(args),
			success: function(resp) {
				if (resp && resp.ret && resp.data.length > 0) {

					var user = resp.data[0].users.length ? resp.data[0].users[0] : null;

					if (!user) return;

					var username = user.username || ""; //用户名称
					var nickname = user.nickname || ""; //店铺名称
					var imageurl = user.imageurl || ""; //店铺logo图片

					var shopBaseInfo = {
						'shopId': shopId,
						'userName': username,
						'shopName': user.webname || nickname,
						'imageUrl': imageurl,
						'isShop': true
					};

					//缓存店铺信息
					cacheShopBaseInfo[shopId] = shopBaseInfo;

					callback && callback.call(self, shopBaseInfo);

				} //end if
			},
			error: function(error) {}
		});
	},

	/*
	 * 去重
	 */
	fixUnique: function(datas) {
		var res = [];
		var states = {};
		var key = "";
		for (var i = 0, len = datas.length; i < len; i++) {
			var obj = datas[i];
			key = obj.fullname;
			if (!states[key]) {
				res.push(obj);
				states[key] = 1;
			}
		}
		return res;
	},

	// 请求相关联系人近两天的聊天消息
	showRecentMsg: function(msgs) {
		var contacts = {};
		var msg, name, prefixMsg;

		if (!msgs || msgs.length == 0) {
			return;
		}

		//倒序 主要是获取聊天的最后一条历史记录
		msgs.reverse();

		for (var i = 0, len = msgs.length; i < len; i++) {
			msg = msgs[i];
			name = msg.F;

			if (!contacts[name]) {
				contacts[name] = {};
				prefixMsg = this.messagePrefix(msg);
				contacts[name].datetime = prefixMsg.datetime;
				contacts[name].content = prefixMsg.content;
			}
		}

		this.updateUserMsg(contacts);
	},
	updateUserMsg: function(contacts) {
		var name, content;

		for (var i in contacts) {
			if (contacts.hasOwnProperty(i)) {
				name = i;
				content = contacts[i].content;
				if (content) {
					$('#' + name).find('.item-msg').text(content);
				}
			}
		}
	},

	messagePrefix: function(msg) {
		var $msg = $(msg.B);

		if ($msg) {
			var text = $msg.text(),
				type = $msg.attr('type'),
				// from = msg.F,
				// owner = '',
				stime = $msg.find('stime'),
				stampOriginal = stime && stime.attr('stamp');

			stampOriginal = new Date(stampOriginal.substr(0, 4) + '-' + stampOriginal.substr(4, 2) + '-' + stampOriginal.substr(6, 2) + stampOriginal.substr(8));

			// isfrom 该显示的消息是自己发的还是对方发的: 1 - 自己发的； 2 - 对方发的
			// if (from == this.selfName) {
			// 	owner = this.selfName;
			// } else {
			// 	owner = msg.T;
			// }

			if (/type="emoticon"/i.test(text) || /type="image"/i.test(text) || type == 'note' || $msg.attr('isHiddenMsg') == '1') {
				text = "您收到一条消息";
			}

			return {
				datetime: stampOriginal,
				content: text
			};
		}
	},
	switchContact: function(newContact, isDefault) {
		var callbacks = callbackList[this.callbackType.switchContact];

		if (!callbacks || callbacks.length === 0) return;

		for (var i = 0; i < callbacks.length; i++) {
			callbacks[i](newContact, isDefault);
		}
	},

	/*
	 * 更新显示左边列表对应的最后的客服聊天消息
	 */
	updateLastHistoryMsg: function(msg, sender, fromName) {
		if (!msg) {
			return
		}
		if (/type="emoticon"/i.test(msg) || /type="image"/i.test(msg)) {
			msg = "您" + (sender === "me" ? "发送" : "收到") + "一条消息";

			//查找左边列表定位到当前客服位置
			this.updateLeftLastInfo(msg, fromName);
		} else {
			//查找左边列表定位到当前客服位置
			this.updateLeftLastInfo(msg, fromName);
		}
	},

	//查找左边列表定位到当前客服位置
	updateLeftLastInfo: function(msg, fromName) {

		if (!fromName) {
			return;
		};

		//查找左边列表定位到当前客服位置
		var $fromName = this.getNode(fromName);

		if ($fromName && $fromName.length) {
			//找到对应客服显示信息。
			$fromName.find('.item-msg').text(msg);
		}
	},

	/*
	 * 更新显示左边列表对应的客服聊天消息
	 */
	updateActiveMsg: function(msg, sender, fromName) {
		if (!msg) {
			return
		}
		if (/type="emoticon"/i.test(msg) || /type="image"/i.test(msg)) {
			msg = "您" + (sender === "me" ? "发送" : "收到") + "一条消息";
		}
		//查找左边列表定位到当前客服位置
		this.updateLeftInfo(msg, fromName);

		//校验左边列表关闭时显示未读数量
		this.checkLeftBarCloseShowUnread();
	},

	//查找左边列表定位到当前客服位置
	updateLeftInfo: function(msg, fromName) {

		if (!fromName) {
			return;
		};

		//查找左边列表定位到当前客服位置
		var $fromName = this.getNode(fromName);

		if ($fromName && $fromName.length) {

			this.updateUnReadNum(fromName);

			//更新当前活动客服位置到第一个位置
			this.updateActiveLocation(fromName);

			//找到对应客服显示信息。
			$fromName.find('.item-msg').text(msg);
		} else {
			//如果找不到左边对应的客服位置需新创建一个
			this.createNewItem(fromName);

			this.updateUnReadNum(fromName);

			//更新当前活动客服位置到第一个位置
			this.updateActiveLocation(fromName);

			this.$activeItem && this.$activeItem.find('.item-msg').text(msg || '');

		};
	},

	/*
	 * 如果聊天对应当前左侧列表不存在需新创建一个
	 */
	createNewItem: function(fromName) {

		//1.创建一个新的用户信息项
		//2.插入到第一个位置
		//3.更新原来左侧列表信息

		var result = [];

		this.defaultStrid = fromName;

		result.push({
			contactId: this.defaultStrid,
			contact: this.defaultStrid,
			virtualId: this.virtualId,
			host: this.setting.toDomain,
			unread: 0,
			isActive: false
		});

		contactCacheList[this.defaultStrid] = contactCacheList[this.defaultStrid] || [];
		contactCacheList[this.defaultStrid].unshift({
			contactId: this.defaultStrid,
			contact: this.defaultStrid,
			virtualId: this.virtualId,
			host: this.setting.toDomain,
			unread: 0,
			isActive: false
		});

		var listContent = QTMPL.list_item.render({
			list: result
		});

		this.$list.prepend(listContent);
		this.$activeItem = $('#' + this.defaultStrid);
	},

	//更新显示数量
	updateUnReadNum: function(fromName) {
		var $fromName = this.getNode(fromName);

		if ($fromName && $fromName.length && $fromName.hasClass('active') === false) {
			//更新数量
			var unread = (contactCacheList[fromName][0].unread - 0) + 1;

			contactCacheList[fromName][0].unread = unread;

			//更新总的数量
			this.totalUnread += 1;
			this.$unreadNum.text(this.totalUnread);

			//显示数量
			if (unread) {
				$fromName.find('.item-unread').text(unread);
				$fromName.find('.item-unread').removeClass('hide');
			} else {
				$fromName.find('.item-unread').addClass('hide')
			}
		}
	},

	//更新总的显示数量
	updateTotalUnread: function() {

		if (this.totalUnread) {
			if (this.totalUnread > 99) {
				this.totalUnread = '99+';
			}

			this.$unreadNum.text(this.totalUnread);
			this.$unreadNum.removeClass('hide');
		} else {
			//this.$unreadNum.remove();
			this.$unreadNum.addClass('hide');
		}
	},

	//更新当前活动客服位置到第一个位置
	updateActiveLocation: function(fromName) {
		// debugger
		$tofirstLi = this.$leftBar.find("li:eq(0)"); //获取第一个<li>元素节点
		if ($tofirstLi.length) {

			var $currentItem = this.getNode(fromName); //获取接收消息的客服节点

			if ($currentItem && $currentItem.length) {
				// $currentItem.insertBefore($tofirstLi); //将当前的Dom移动到指节点前面
			}
		}
	},

	//用于当前用户输入发送信息后调用。
	//更新当前活动客服聊天的消息数量
	// updateActiveUnreadNum: function() {
	// 	var self = this;

	// 	if (self.$activeItem.length) {
	// 		self.$activeItem.find('.item-unread').addClass('hide');
	// 	}

	// 	var unreadCount = contactCacheList[self.activeId][0].unread || 0;
	// 	if (self.totalUnread >= unreadCount) {
	// 		self.totalUnread -= unreadCount;
	// 	} else {
	// 		self.totalUnread = 0;
	// 	}

	// 	if (self.totalUnread == 0) {
	// 		//self.$unreadNum.remove();
	// 		self.$unreadNum.addClass('hide');
	// 	} else if (self.totalUnread < 99) {
	// 		self.$unreadNum.text(self.totalUnread);
	// 		self.$unreadNum.removeClass('hide');
	// 	}

	// 	//清除消息数量
	// 	if (self.$activeItem.length) {
	// 		self.$activeItem.find('.item-unread').text(0);
	// 	}
	// 	contactCacheList[self.activeId][0].unread = 0;
	// },

	//校验左边列表关闭时显示未读数量
	checkLeftBarCloseShowUnread: function() {

		//如果左边关闭时,有新消息将显示。
		if (this.$container.hasClass("lb_close")) {

			//更新总的显示数量
			this.updateTotalUnread();
		}
	},
	getNode: function(fromName) {
		var node = document.getElementById(fromName);
		if (node) {
			return $(node);
		}

		return null;
	},

	/*
	 * 隐藏左边栏
	 */
	hide: function() {
		$("#leftbar").hide();
		$("#chatwindow").css({
			"left": "10px"
		});
	},
	// 设置缓存的
	setCache: function(shopId, consultId, consultName) {
		if(consultName) {
			cacheWebname[consultId] = consultName;
		}
        
		cacheShopSeat[shopId] = cacheShopSeat[shopId] || {};
		cacheShopSeat[shopId].strid = consultId;
	},
	getCacheWebname: function(id) {
		return cacheWebname[id] || '';
	}
}

module.exports = LeftBar;