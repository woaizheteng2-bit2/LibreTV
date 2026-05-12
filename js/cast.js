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
                // 显示提示
                this._showToast('正在加载投屏服务，请稍后重试...');
                return;
            }

            // 都不支持，提示用户使用浏览器内置投屏（支持 DLNA）
            // 三星/小米/海信等电视大多使用 DLNA 协议
            this._showCastGuide();
        },

        /**
         * 显示投屏引导（针对 DLNA 设备，如三星电视）
         */
        _showCastGuide: function () {
            var isChrome = navigator.userAgent.indexOf('Chrome') > -1;
            var isEdge = navigator.userAgent.indexOf('Edg') > -1;
            var isSafari = navigator.userAgent.indexOf('Safari') > -1 
                && navigator.userAgent.indexOf('Chrome') === -1;
            var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            var msg;
            if (isMobile && isChrome) {
                msg = '点Chrome地址栏旁边⋮→「投屏」选电视';
            } else if (isChrome || isEdge) {
                msg = '点浏览器右上角⋮→「投屏」\n支持DLNA（三星/小米/海信等电视）';
            } else if (isSafari) {
                msg = '点Safari菜单→「AirPlay」投屏';
            } else {
                msg = '请使用Chrome或Edge浏览器\n点击右上角⋮→「投屏」选电视';
            }
            this._showToast(msg);
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
                    // 全部失败，显示详细错误
                    var errMsg = '投屏失败';
                    var isChrome = navigator.userAgent.indexOf('Chrome') > -1;
                    
                    if (err && err.code === 'LOAD_CANCELLED') {
                        errMsg = '投屏已取消';
                    } else if (err && err.code === 'TIMEOUT') {
                        errMsg = '投屏超时\n请确认电视网络正常';
                    } else if (videoUrl.startsWith('http://')) {
                        errMsg = '投屏失败\n可尝试Chrome右上角⋮→「投屏」';
                    } else if (isChrome) {
                        // 三星等DLNA电视推荐用Chrome内置投屏
                        errMsg = '投屏不成功\n试试Chrome右上角⋮→「投屏」\n支持DLNA电视（三星/小米等）';
                    } else {
                        errMsg = '投屏失败\n建议使用Chrome浏览器的投屏功能';
                    }
                    self._showToast(errMsg);
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
