import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'
import {createHotHandler} from './server/hotMovies'

const hotHandlers = {movies: createHotHandler('movie'), tv: createHotHandler('tv')};

// Vite 的开发与生产构建配置，使用 SWC 插件处理 React 和开发热更新。
export default defineConfig({
    plugins: [react(), {
        name: 'local-hot-movies',
        // 这里只接入开发服务器；线上 /api 路径由 functions 中的 Pages 函数提供。
        configureServer(server) {
            // 本地开发复用 Pages 的上游处理器，无需另启一个后端。
            server.middlewares.use(async (req, res, next) => {
                const path = req.url?.split('?')[0];
                const handle = path === '/api/hot/movies' ? hotHandlers.movies : path === '/api/hot/tv' ? hotHandlers.tv : undefined;
                if (!handle) return next();
                try {
                    const response = await handle(new Request(`http://localhost${path}`, {method: req.method}));
                    res.statusCode = response.status;
                    response.headers.forEach((value, key) => res.setHeader(key, value));
                    res.end(await response.text());
                } catch (error) {
                    next(error);
                }
            });
        },
    }],
})
