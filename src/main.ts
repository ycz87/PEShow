import { createApp } from 'vue'

// 字体全部本地打包（不依赖 CDN），中文字体按 unicode-range 分片按需加载
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/800.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/zcool-kuaile/400.css'
import '@fontsource/kalam/400.css'
import '@fontsource/kalam/700.css'
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css'
import 'lxgw-wenkai-webfont/lxgwwenkai-bold.css'
import 'katex/dist/katex.min.css'

import './styles/global.css'
import './styles/stage.css'
import './styles/chart.css'
import App from './App.vue'

createApp(App).mount('#app')
