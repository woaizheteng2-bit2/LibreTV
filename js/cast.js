/**
 * LibreTV 投屏管理器
 * 支持：Google Cast (Chromecast) + AirPlay
 * 
 * 使用方式：
 *   1. 在 player.html 中加载此脚本
 *   2. 在 ArtPlayer 初始化中添加 controls 按钮：
 *      {
 *          position: 'right',
 *          index: 100,
 *          html: '<svg class="art-icon" viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h8v2H3v-2zm0 4h8v2H3v-2zm14-4v4h4v-4h-4zm-2 6v-8h8v8h-8z"/></svg>',
 *          tooltip: '投屏',
 *          click: function() { window.CastManager.cast(this); }
 *      }
 */

(function () {
    'use strict';

    window.CastManager = {
        castAvailable: false,
        airplayAvailable: false,
        initialized: false,
        _castSDKLoaded: false,
        _currentArt: null,
        _toastTimer: null,

        /**
         * 初始化投屏管理器
         */
        init: function () {
            if (this.initialized) return;
            this.initialized = true;

            // 检测 AirPlay (Safari)
            this.airplayAvailable = !!(
                window.WebKitPlaybackTargetPicker ||
                window.WebKitPlaybackTargetAvailabilityEvent
            );

            // 加载 Google Cast SDK
            this._loadCastSDK();

            console.log('[Cast] 初始化完成, AirPlay:', this.airplayAvailable);
        },

        /**
         * 加载 Google Cast Sender SDK
         */
        _loadCastSDK: function () {
            if (this._castSDKLoaded) return;
            this._castSDKLoaded = true;

            // 先从 chrome.cast 检查是否原生可用
            if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
                this._onCastSDKReady();
                return;
            }

            // Chrome/Edge 浏览器原生就内置了 Cast 功能
            // 但编程式投屏需要加载 Google Cast SDK
            // 注意: gstatic.com 在国内可能需要科学上网
            var script = document.createElement('script');
            script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = this._onCastSDKReady.bind(this);
            script.onerror = function () {
                console.warn('[Cast] Google Cast SDK 加载失败');
                // SDK 不可用，但浏览器内置的 Cast 功能仍然可用
                // 用户可以手动点击浏览器菜单 > 投屏
                window.CastManager.castAvailable = false;
                
                // 提示用户使用浏览器内置投屏
                setTimeout(function () {
                    window.CastManager._showToast(
                        '如需投屏，请点击浏览器右上角菜单 > "投屏" 按钮'
                    );
                }, 2000);
            };
            document.head.appendChild(script);
        },

        _onCastSDKReady: function () {
            if (!window.cast || !window.cast.framework) {
                console.warn('[Cast] Cast SDK 未就绪');
                return;
            }

            try {
                var context = cast.framework.CastContext.getInstance();
                context.setOptions({
                    receiverApplicationId: 'CC1AD845', // 默认 Media Receiver，无需注册
                    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
                });

                // 监听投屏状态变化
                context.addEventListener(
                    cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
                    function (event) {
                        switch (event.sessionState) {
                            case cast.framework.SessionState.SESSION_STARTED:
                            case cast.framework.SessionState.SESSION_RESUMED:
                                console.log('[Cast] 已连接到投屏设备');
                                // 如果当前有正在播放的视频，自动投屏
                                if (window.CastManager._currentArt) {
                                    window.CastManager._castCurrent(
                                        window.CastManager._currentArt
                                    );
                                }
                                break;
                            case cast.framework.SessionState.SESSION_ENDED:
                                console.log('[Cast] 投屏已断开');
                                break;
                        }
                    }
                );

                this.castAvailable = true;
                console.log('[Cast] Google Cast SDK 已就绪');
            } catch (e) {
                console.warn('[Cast] 初始化失败:', e);
            }
        },

        /**
         * 检查是否有可用的投屏设备
         */
        isAvailable: function () {
            return this.castAvailable || this.airplayAvailable;
        },

        /**
         * 主投屏入口 - 由 ArtPlayer 按钮触发
         * @param {Object} art - ArtPlayer 实例
         */
        cast: function (art) {
            if (!art) return;
            
            this._currentArt = art;

            // 优先尝试 Google Cast
            if (this.castAvailable && window.cast && window.cast.framework) {
                this._castWithGoogleCast(art);
                return;
            }

            // Safari AirPlay
            if (this.airplayAvailable) {
                this._castWithAirPlay(art);
                return;
            }

            // Cast SDK 还没加载完，先触发加载
            if (!this._castSDKLoaded) {
                this._loadCastSDK();
                this._showToast('正在加载投屏服务...');
                return;
            }

            // 都不支持，直接显示三星电视专用扫码投屏
            this._showSamsungQR();
        },

        /**
         * 三星电视专用：显示扫码投屏
         * 三星2015年电视使用私有AllShare协议，Google Cast/DLNA均不兼容
         * 最佳方案：手机扫码播放，再用三星Smart View投屏到电视
         */
        _showSamsungQR: function () {
            this._showToast('三星电视请扫码后用手机投屏');
            setTimeout(function () {
                window.CastManager.showQRCode();
            }, 1200);
        },

        /**
         * 在 Google Cast 投屏失败后显示其他选项
         */
        _showCastFallback: function () {
            var self = this;
            // 1秒后显示三星扫码方案
            setTimeout(function () {
                self._showToast('三星电视建议扫码投屏');
                setTimeout(function () {
                    self.showQRCode();
                }, 1200);
            }, 1000);
        },

        /**
         * 使用 Google Cast 投屏
         */
        _castWithGoogleCast: function (art) {
            var videoUrl = this._getVideoUrl(art);
            var title = this._getVideoTitle();
            var poster = art.poster || '';

            if (!videoUrl) {
                this._showToast('无法获取视频链接');
                return;
            }

            try {
                var context = cast.framework.CastContext.getInstance();
                var session = context.getCurrentSession();

                if (!session) {
                    // 请求连接设备
                    context.requestSession()
                        .then(function () {
                            session = context.getCurrentSession();
                            if (session) {
                                window.CastManager._loadMedia(session, videoUrl, title, poster);
                            }
                        })
                        .catch(function (err) {
                            if (err.code === 'CANCEL' || err.code === 'cancel') {
                                // 用户取消了选择
                                return;
                            }
                            console.error('[Cast] 连接失败:', err);
                            window.CastManager._showToast('投屏连接失败');
                        });
                } else {
                    this._loadMedia(session, videoUrl, title, poster);
                }
            } catch (e) {
                console.error('[Cast] 投屏出错:', e);
                this._showToast('投屏出错，请重试');
            }
        },

        /**
         * 发送媒体到投屏设备
         * 尝试多种方式加载，提高成功率
         */
        _loadMedia: function (session, videoUrl, title, poster, attempt) {
            attempt = attempt || 1;
            var self = this;

            // 如果视频是 HTTP 的，Chromecast 默认媒体接收器可能拒绝
            // 尝试转为 HTTPS（某些源支持同时使用 HTTP 和 HTTPS）
            if (attempt === 1 && videoUrl.startsWith('http://')) {
                videoUrl = videoUrl.replace('http://', 'https://');
            }

            // 确定 MIME 类型 - 使用更多兼容格式
            var contentType;
            if (videoUrl.endsWith('.m3u8')) {
                contentType = 'application/x-mpegurl';
            } else if (videoUrl.endsWith('.mp4')) {
                contentType = 'video/mp4';
            } else if (videoUrl.endsWith('.webm')) {
                contentType = 'video/webm';
            } else {
                contentType = 'video/mp4';
            }

            var mediaInfo = new chrome.cast.media.MediaInfo(videoUrl, contentType);
            mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
            mediaInfo.metadata.title = title || 'LibreTV';
            
            if (poster) {
                mediaInfo.metadata.images = [new chrome.cast.Image(poster)];
            }

            // 添加自定义请求头（部分源需要 Referer）
            // mediaInfo.customData = { headers: { Referer: window.location.origin + '/' } };

            var request = new chrome.cast.media.LoadRequest(mediaInfo);
            request.autoplay = true;
            // 不设置 currentTime，让 Chromecast 从视频开始播放
            // 某些源不支持 seek

            session.loadMedia(request)
                .then(function () {
                    console.log('[Cast] 投屏成功:', title);
                    self._showToast('已投屏到电视 ✓');
                })
                .catch(function (err) {
                    console.error('[Cast] 投屏加载失败 (尝试' + attempt + '):', err);
                    
                    // 尝试不同的策略
                    if (attempt === 1) {
                        // 第一次失败: 尝试原始 URL 和备用 content type
                        var origUrl = window.CastManager._getVideoUrl(
                            window.CastManager._currentArt
                        );
                        window.CastManager._showToast('正在尝试其他播放方式...');
                        window.CastManager._loadMedia(session, origUrl, title, poster, 2);
                    } else if (attempt === 2) {
                        // 第二次失败: 尝试 MP4 content type
                        var mp4Url = videoUrl.endsWith('.m3u8') 
                            ? videoUrl 
                            : videoUrl;
                        window.CastManager._loadMedia(session, videoUrl, title, poster, 3);
                    } else {
                    // 全部失败，显示详细错误并推荐三星扫码方案
                    self._showCastFallback();
                    }
                });
        },

        /**
         * 使用 AirPlay 投屏 (Safari)
         */
        _castWithAirPlay: function (art) {
            var videoEl = art.video;
            if (!videoEl) return;

            // Safari AirPlay API
            if (videoEl.webkitShowPlaybackTargetPicker) {
                videoEl.webkitShowPlaybackTargetPicker();
            } else if (window.WebKitPlaybackTargetPicker) {
                window.WebKitPlaybackTargetPicker.showPicker(videoEl);
            } else {
                this._showToast('请在浏览器菜单中点击 AirPlay 按钮');
            }
        },

        /**
         * 投屏当前正在播放的视频（在 Cast 连接后自动触发）
         */
        _castCurrent: function (art) {
            if (this.castAvailable) {
                this._castWithGoogleCast(art);
            }
        },

        /**
         * 获取当前视频 URL（从 ArtPlayer 实例）
         */
        _getVideoUrl: function (art) {
            if (!art) return null;

            // 尝试从 ArtPlayer 获取当前源
            var url = art.url;
            if (url) return url;

            // 从 video 标签获取
            var video = art.video;
            if (video) {
                var src = video.currentSrc || video.src;
                if (src && src !== window.location.href) return src;
                
                // 检查 source 标签
                var sources = video.querySelectorAll('source');
                for (var i = 0; i < sources.length; i++) {
                    if (sources[i].src) return sources[i].src;
                }
            }

            // 从全局变量获取
            if (window.currentVideoUrl) return window.currentVideoUrl;

            // 从 localStorage 获取
            try {
                var stored = localStorage.getItem('currentVideoUrl');
                if (stored) return stored;
            } catch (e) {}

            return null;
        },

        /**
         * 获取视频标题
         */
        _getVideoTitle: function () {
            var title = document.getElementById('videoTitle');
            if (title) return title.textContent || '';

            if (window.currentVideoTitle) return window.currentVideoTitle;

            return document.title.replace(' - LibreTV', '') || 'LibreTV';
        },

        /**
         * 显示 Toast 提示
         */
        _showToast: function (message) {
            if (this._toastTimer) {
                clearTimeout(this._toastTimer);
            }

            // 复用页面已有的 toast 机制
            var toast = document.getElementById('toast');
            var msgEl = document.getElementById('toastMessage');
            if (toast && msgEl) {
                msgEl.textContent = message;
                toast.classList.remove('opacity-0', '-translate-y-full');
                toast.classList.add('opacity-100', 'translate-y-0');
                this._toastTimer = setTimeout(function () {
                    toast.classList.remove('opacity-100', 'translate-y-0');
                    toast.classList.add('opacity-0', '-translate-y-full');
                    window.CastManager._toastTimer = null;
                }, 3500);
                return;
            }

            // 兜底：创建临时 toast
            var existing = document.getElementById('_cast_toast');
            if (existing) existing.remove();

            var div = document.createElement('div');
            div.id = '_cast_toast';
            div.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 24px;border-radius:10px;z-index:99999;font-size:14px;max-width:85%;text-align:center;white-space:pre-line;opacity:0;transition:opacity 0.3s;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);';
            div.textContent = message;
            document.body.appendChild(div);
            
            requestAnimationFrame(function () {
                div.style.opacity = '1';
            });

            this._toastTimer = setTimeout(function () {
                div.style.opacity = '0';
                setTimeout(function () { div.remove(); }, 300);
                window.CastManager._toastTimer = null;
            }, 3500);
        },

        /**
         * 显示扫码投屏弹窗（三星电视专用）
         */
        showQRCode: function () {
            var art = this._currentArt;
            var title = this._getVideoTitle();
            var videoUrl = this._getVideoUrl(art);
            
            // 构建分享链接 - 当前播放器页面URL
            var shareUrl = window.location.href;
            
            // 获取或创建QR弹窗
            var modal = document.getElementById('castQRModal');
            if (!modal) {
                modal = this._createQRModal();
            }
            
            // 更新QR码图片
            var qrImg = document.getElementById('castQRImage');
            if (qrImg) {
                var encodedUrl = encodeURIComponent(shareUrl);
                qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodedUrl;
                qrImg.alt = title;
            }
            
            // 显示视频标题
            var titleEl = document.getElementById('castQRTitle');
            if (titleEl) titleEl.textContent = title || '正在播放';
            
            // 显示链接
            var linkEl = document.getElementById('castQRLink');
            if (linkEl) linkEl.textContent = shareUrl;
            
            // 显示弹窗
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(function () {
                modal.classList.remove('opacity-0');
                modal.classList.add('opacity-100');
            }, 10);
        },

        /**
         * 关闭扫码投屏弹窗
         */
        hideQRCode: function () {
            var modal = document.getElementById('castQRModal');
            if (modal) {
                modal.classList.remove('opacity-100', 'flex');
                modal.classList.add('opacity-0');
                setTimeout(function () {
                    modal.classList.add('hidden');
                }, 300);
            }
        },

        /**
         * 创建扫码投屏弹窗DOM
         */
        _createQRModal: function () {
            var modal = document.createElement('div');
            modal.id = 'castQRModal';
            modal.className = 'fixed inset-0 bg-black/80 hidden items-center justify-center z-[10002] opacity-0 transition-opacity duration-300';
            modal.innerHTML = '<div class="bg-[#111] rounded-2xl p-6 w-80 border border-[#333] shadow-2xl text-center">'
                + '<h3 class="text-lg font-bold text-white mb-1">📱 手机扫码播放</h3>'
                + '<p class="text-gray-400 text-xs mb-4">用手机扫描二维码，然后通过三星 Smart View 投屏到电视</p>'
                + '<div class="bg-white rounded-xl p-3 inline-block mb-3">'
                + '<img id="castQRImage" src="" alt="QR码" class="w-60 h-60">'
                + '</div>'
                + '<p id="castQRTitle" class="text-white text-sm font-medium mb-1 truncate px-2"></p>'
                + '<p class="text-gray-500 text-xs mb-4 break-all px-2" id="castQRLink"></p>'
                + '<div class="flex gap-2">'
                + '<button onclick="window.CastManager.hideQRCode()" class="flex-1 px-3 py-2 bg-[#333] hover:bg-[#444] text-white rounded-lg text-sm transition-colors">关闭</button>'
                + '<button onclick="window.CastManager._copyQRUrl()" class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">复制链接</button>'
                + '</div>'
                + '<p class="text-gray-500 text-xs mt-3">💡 手机上打开链接后，用 <span class="text-blue-400">三星 Smart View</span> 应用投屏到电视</p>'
                + '</div>';
            document.body.appendChild(modal);
            return modal;
        },

        /**
         * 复制当前视频链接
         */
        _copyQRUrl: function () {
            var url = window.location.href;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(function () {
                    window.CastManager._showToast('链接已复制 ✓');
                }).catch(function () {
                    window.CastManager._fallbackCopy(url);
                });
            } else {
                this._fallbackCopy(url);
            }
        },

        _fallbackCopy: function (text) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            this._showToast('链接已复制 ✓');
        },

        /**
         * 获取投屏状态（供 UI 更新使用）
         */
        getState: function () {
            var state = { available: false, connected: false, type: null };
            
            if (this.castAvailable) {
                state.available = true;
                try {
                    var context = cast.framework.CastContext.getInstance();
                    var session = context.getCurrentSession();
                    state.connected = !!session;
                    state.type = 'chromecast';
                } catch (e) {}
            } else if (this.airplayAvailable) {
                state.available = true;
                state.type = 'airplay';
            }

            return state;
        }
    };

    // 页面加载后自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.CastManager.init();
        });
    } else {
        window.CastManager.init();
    }

})();
