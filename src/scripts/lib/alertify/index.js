/* 
 * @Author: haoliang.yan
 * @Date:   2015-04-27 17:36:07
 * @Last Modified by:   haoliang.yan
 * @Last Modified time: 2015-04-28 14:22:11
 * @Description 增加模块化输出
 */
 'use strict';

require('./src/alertify.js');

if(typeof exports !== 'undefined') {
    module.exports = QNR.alertify;
}