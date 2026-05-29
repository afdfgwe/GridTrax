---
trigger: always_on
---

请参考以下网址进行Bangumi的导入/导出设置
https://bangumi.github.io/api/
https://next.bgm.tv/demo/login?backTo=%2Fdemo%2Faccess-token
开发者令牌：yuSboixeD52mhQjaxiUmarJ862Ku9qBkwwRX8TEg
https://github.com/bangumi/api/
你可以直接Clone该项目 https://github.com/bangumi/api.git

目的：可实现通过让用户登录自己在bgm.tv的账号，来实现把他们的Bangumi状态同步到GridTrax，做出导入按钮用于第一次同步；并设法做到以后用户在GridTrax做出进度后，自动更新到Bangumi；以及之后的Bangumi增量同步（对于有冲突的数据，可选是从Bangumi覆盖GridTrax还是保留当前数据）；对于条目同步，仅检索TMDB和Bangumi有重合的条目，若出现TMDB有条目而在Bangumi找不到，则该条目不予以同步，若出现Bangumi有的条目在TMDB找不到，则直接略过