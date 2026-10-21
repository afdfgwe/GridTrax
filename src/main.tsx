import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 应用入口：挂载到 index.html 的根节点，并加载全局基础样式。
// 严格模式在开发环境会额外检查渲染和副作用，便于发现未清理的订阅等问题。
// 非空断言依赖 index.html 始终提供 id 为 root 的元素，修改模板时需同步检查。
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>,
)
