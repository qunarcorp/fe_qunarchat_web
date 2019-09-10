/*
 * @Author: nengting.jiang
 * @Date:  20160328
 * @Last Modified by: nengting.jiang
 * @Last Modified time: 20160328
 * @Description 音频播放
 */

var audioPlayer = {
	/*
	 * 播放器
	 * id:播放器ID
	 * file:播放音乐文件
	 * loop:是否循环 loop=true,false
	 */
	player: null,
	play: function(id, file, loop) {
		if(!id || !file) {
			return
		}
		
		this.player = this.player || document.getElementById(id);

		if (!this.player) {
			var newPlayer
			// document.body.removeChild(audioplayer);
			if (navigator.userAgent.indexOf("MSIE") > 0) { // IE 

				newPlayer = document.createElement('bgsound');
				newPlayer.id = id;
				newPlayer.src = file;
				newPlayer.setAttribute('autostart', 'true');

				if (loop) {
					newPlayer.setAttribute('loop', 'infinite');
				}

				document.body.appendChild(newPlayer);

			} else { // Other FF Chome Safari Opera

				newPlayer = document.createElement('audio');
				newPlayer.id = id;
				newPlayer.setAttribute('autoplay', 'autoplay');
				if (loop) {
					newPlayer.setAttribute('loop', 'loop');
				}

				var mp3 = document.createElement('source');
				mp3.src = file;
				mp3.type = 'audio/mpeg';
				newPlayer.appendChild(mp3);
				
				document.body.appendChild(newPlayer);
			}

			newPlayer.onload = function() {
				audioPlayer.player = newPlayer
			}
		}else if(this.player) {
			this.player.play()
		}
	}	
}


module.exports = audioPlayer;