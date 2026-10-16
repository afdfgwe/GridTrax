import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'

// Vite 的开发与生产构建配置，使用 SWC 插件处理 React 和开发热更新。
export default defineConfig({
    plugins: [react()],
})
