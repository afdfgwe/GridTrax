import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import {defineConfig, globalIgnores} from 'eslint/config'

// 静态检查只覆盖项目 TypeScript 源码；构建产物不参与检查。
export default defineConfig([
    globalIgnores(['dist']),
    {
        files: ['**/*.{ts,tsx}'],
        // 组合基础语法、类型、Hook 使用和开发热更新约束。
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            // 检查 Hook 调用顺序、依赖和副作用，防止状态更新出现循环或使用过期闭包。
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser, // 源码运行于浏览器，允许 window、document 等全局对象。
        },
    },
])
