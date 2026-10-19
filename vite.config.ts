import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'
import {createHotMoviesHandler} from './server/hotMovies'

const hotMovies = createHotMoviesHandler();

// Vite 的开发与生产构建配置，使用 SWC 插件处理 React 和开发热更新。
export default defineConfig({
    plugins: [react(), {
        name: 'local-hot-movies',
        configureServer(server) {
            // 本地开发复用 Pages 的上游处理器，无需另启一个后端。
            server.middlewares.use(async (req, res, next) => {
                if (req.url?.split('?')[0] !== '/api/hot/movies') return next();
                try {
                    const response = await hotMovies(new Request('http://localhost/api/hot/movies', {method: req.method}));
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
