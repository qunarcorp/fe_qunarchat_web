/*
 * @Author: haoliang.yan
 * @Date:   2015-03-26 03:31:27
 * @Last Modified by:   haoliang.yan
 * @Last Modified time: 2015-05-22 14:03:54
 * @Description 路由模块
 * @Version 0.1.2
 */

/**
 * ChangeLog
 * 0.1.2
 * - 部分机型页面刷新时会触发popstate事件，忽略之
 * - 增加sandbox.to属性
 */

(function(QNR) {
    'use strict';

    var sandbox = (function() {
        var data = null;

        return {
            from: null,
            push: function(args) {
                data = args;
            },
            pop: function() {
                return data;
            },
            reset: function() {
                data = null;
                this.from = null;
            }
        }
    })();

    var RHistory = {
        support: (window.history.state !== undefined),
        map: null,
        current: null,
        set: function(state) {
            localStorage.setItem('HISTORY_STATE', JSON.stringify(state));
        },
        get: function() {
            var st = localStorage.getItem('HISTORY_CURRENT') || '';
            if (st) {
                return JSON.parse(st);
            } else {
                return null;
            }
        }
    };

    function Router() {
        // 当前状态与上一个状态
        this._current = null;
        this._last = null;
    }

    Router.prototype = {
        register: function(key) {
            // 路由注册
            return new Router.routes(key);
        },
        route: function(state, data) {
            // 路由跳转
            // @param state 下一个路由状态
            // @param data 传递给下一个路由状态的数据
            if(this._current.state ===  state){
                return;
            }
            // 将数据压入沙箱
            sandbox.push(data);
            // 创建新的状态
            this._last = this._current;
            this._current = new Router.state(state, data);

            history.pushState(this._current, null, '');

            if (!RHistory.support) {
                RHistory.set(this._current);
            }

            this.dispatch();
        },
        back: function(data) {
            // 路由回退
            sandbox.push(data);
            history.back();
        },
        replace: function(state, data, url) {
            // 状态替换
            var st;
            if (!state) {
                st = this._current;
            } else if (this._current && this._current.state === state) {
                st = this._current;
                this._current.data = data;
            } else {
                st = new Router.state(state, data);
                this._current = st;
            }
            history.replaceState(st, null, url || '');
            if (!RHistory.support) {
                RHistory.set(st);
            }
        },
        listen: function(root) {
            var self = this;
            // 开始监听浏览器popstate事件
            window.onpopstate = function(e) {
                if(!e.state) {
                    return false;
                }
                // dispatch
                self._last = self._current;
                self._current = e.state;

                if (!self._current) {
                    return false;
                }

                this.dispatch();
            }.bind(self);

            this._current = history.state;
            this._root = root;

            if (!this._current && root) {
                this.replace(root, {});
            }
            this.dispatch();
        },
        dispatch: function() {
            var route;

            sandbox.from = this._last && this._last.state || null;
            sandbox.to = this._current && this._current.state;

            if (!sandbox.from) {
                this._last = new Router.state(this._root, null);
            }

            if (this._last && this._last.state) {
                route = this._getRouter(this._last);
                if (route && route._after) {
                    if (route._ctx) {
                        route._after.call(route._ctx, sandbox);
                    } else {
                        route._after(sandbox);
                    }
                }
            }

            if (this._current && this._current.state) {
                route = this._getRouter(this._current);
                if (route && route._before) {
                    if (route._ctx) {
                        route._before.call(route._ctx, sandbox, this._current);
                    } else {
                        route._before(sandbox);
                    }
                }
            }

            sandbox.reset();
        },
        state: function() {
            if (RHistory.support) {
                return history.state;
            } else {
                return RHistory.get();
            }
        },
        _getRouter: function(state) {
            var key, route;
            for (key in Router.routes.defined) {
                route = Router.routes.defined[key];
                if (route.match(state)) {
                    return route;
                }
            }
            return null;
        }
    };

    // 路由状态, 包含状态、数据两部分
    Router.state = function(state, data) {
        this.state = state;
        this.data = data || null;
    }

    Router.state.prototype = {
        setData: function(data) {
            this.data = data;
        },
        getData: function() {
            return this.data;
        }
    }

    // 路由表项
    Router.routes = function(key) {
        this._key = key;

        this._pattern = null;
        //
        this._before = null;
        this._after = null;

        this._ctx = null;

        // 加入路由表
        Router.routes.defined[key] = this;

        return this;
    };

    // 用于存放所有路由表
    Router.routes.defined = {};

    Router.routes.prototype = {
        match: function(state) {
            var current = state.state;
            if (!this._pattern) {
                // 如果未定义规则，则取key值进行比较
                return this._key === current;
            }
            // 检查一个状态是否符合规则
            if (typeof this._pattern === 'function') {
                return this._pattern(state);
            } else {
                return current === this._pattern;
            }
        },
        context: function(obj) {
            this._ctx = obj;
            return this;
        },
        pattern: function(ptn) {
            this._pattern = ptn;
            return this;
        },
        before: function(fn) {
            this._before = fn;
            return this;
        },
        after: function(fn) {
            this._after = fn;
            return this;
        }
    };

    if (typeof exports != 'undefined') {
        module.exports = new Router();
    } else {
        QNR.HRouter = new Router();
    }
})(window.QNR || (window.QNR = {}));