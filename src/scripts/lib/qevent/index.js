(function(QNR) {

    'use strict';

    function isArray(ary) {
        return Object.prototype.toString.apply(ary) === '[object Array]';
    }

    function isPlainObject(obj) {
        return typeof obj == "object" && Object.getPrototypeOf(obj) == Object.prototype
    }

    var Event = {

        __listeners: {},

        on: function(event, handler, context) {
            if (!event || typeof handler !== 'function') {
                return this;
            }

            this.__listeners[event] = this.__listeners[event] || [];
            this.__listeners[event].unshift({
                context: context || null,
                fn: handler
            }); // 向前添加

            return this;
        },

        un: function(event, handler) {
            if (!event || typeof handler !== 'function') {
                return this;
            }

            if (event instanceof Array) {
                var i = event.length;
                while (i--) {
                    this.un(event[i], handler);
                }
                return this;
            }

            var listener = this.__listeners[event],
                i;
            if (!listener) return this;
            i = listener.length;
            while (i--) {
                if (listener[i].fn === handler) {
                    listener.splice(i, 1);
                }
            }

            return this;
        },

        fire: function(event) {
            var args = Array.prototype.slice.call(arguments, 1), // 移除事件名称
                i, listener;

            if (!event) {
                return false;
            }
            listener = this.__listeners[event];
            i = listener.length;
            if (!listener) return;

            while (i--) {
                (function(handler) {
                    return function() { // 使用闭包，避免嵌套调用使变量改变
                        handler.fn.apply(handler.context, args);
                    };
                })(listener[i])();
            }

        }
    };

    QNR.qevent = Event;

})(window.QNR || (window.QNR = {}));