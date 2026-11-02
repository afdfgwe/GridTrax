/** 仅展示可理解的错误，不把鉴权头、请求配置等内部信息显示到页面。 */
export function requestErrorMessage(error: unknown): string {
    // 只依赖通用错误结构，普通 Error 或没有响应的网络异常也能使用统一兜底文案。
    const detail = error as { code?: string; response?: { status?: number } } | null;
    const status = detail?.response?.status;
    if (status === 401 || status === 403) return '接口鉴权失败，请检查部署时配置的 TMDB Token。';
    if (status === 429) return '请求过于频繁，请稍后重试。';
    if (status === 404) return '未找到请求的资料。';
    if (detail?.code === 'ECONNABORTED' || detail?.code === 'ETIMEDOUT') return '请求超时，请检查网络后重试。';
    return '加载失败，请检查网络连接后重试。';
}
