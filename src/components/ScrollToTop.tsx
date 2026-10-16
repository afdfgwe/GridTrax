import {useLayoutEffect} from 'react';
import {useLocation} from 'react-router-dom';

/** 路径切换时重置滚动位置，避免详情页继承追踪列表的滚动高度。 */
const ScrollToTop = () => {
    const {pathname} = useLocation();

    // 在浏览器绘制前归零；仅监听路径，不因同页状态或查询参数变化重复滚动。
    // 返回上一条路由也会归零，此处不负责恢复历史滚动位置。
    useLayoutEffect(() => {
        window.scrollTo({top: 0, left: 0, behavior: 'instant'});
    }, [pathname]);

    return null;
};

export default ScrollToTop;
