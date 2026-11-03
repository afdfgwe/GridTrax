import assert from 'node:assert/strict';
import test from 'node:test';

// 覆盖观影状态 store：整季/单集状态变更、补海报与记录增删，并校验持久化结果。

// 独立内存存储，测试永远不会读写用户浏览器中的实际观影记录。
const values = new Map();
globalThis.window = {
    localStorage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    }
};
// 必须先安装存储替身再动态导入：Zustand 在模块初始化时就会尝试恢复持久化状态。
const {useProgressStore} = await import('../src/store/useProgressStore.ts');
const reset = () => useProgressStore.setState({data: {user_id: 'test', last_sync: 0, records: {}}});

test('单集切换和看到这里按真实集号操作，保留其他集数及历史备注', () => {
    reset();
    const store = useProgressStore.getState();
    store.setSeasonStatus(1, 2, 'Do', {episode_count: 25, name: '第2季'});
    useProgressStore.setState(state => ({
        data: {
            ...state.data, records: {
                ...state.data.records,
                tmdb_tv_1_s2: {
                    ...state.data.records.tmdb_tv_1_s2,
                    rating: 9,
                    global_comment: '旧版整季备注',
                    episodes: {8: {watched: false, comment: '旧版单集备注'}}
                },
            }
        }
    }));
    store.toggleEpisodeWatched(1, 2, 20);
    store.watchUpToEpisode(1, 2, 8);
    let record = store.getSeasonRecord(1, 2);
    assert.equal(record.global_status, 'Do');
    assert.ok(record.last_interacted > 0);
    assert.equal(Object.values(record.episodes).filter(ep => ep.watched).length, 9);
    assert.equal(record.episodes[20].watched, true);
    assert.equal(record.rating, 9);
    assert.equal(record.global_comment, '旧版整季备注');
    assert.equal(record.episodes[8].comment, '旧版单集备注');
    store.toggleEpisodeWatched(1, 2, 8);
    record = store.getSeasonRecord(1, 2);
    assert.equal(record.episodes[8].watched, false);
    assert.equal(record.episodes[7].watched, true);
    assert.equal(record.episodes[20].watched, true);
});

test('补海报不修改观看状态、最近互动或历史评分备注', () => {
    reset();
    const store = useProgressStore.getState();
    store.setMovieStatus(3, 'Collect', {name: '影片'});
    const before = store.getMovieRecord(3);
    store.fillMissingPosters('movie', 3, '/poster.jpg');
    assert.deepEqual(store.getMovieRecord(3), {...before, poster_path: '/poster.jpg'});
    store.fillMissingPosters('movie', 3, '/replacement.jpg');
    assert.equal(store.getMovieRecord(3).poster_path, '/poster.jpg');
});

test('浏览电影不会自动加入追踪，状态变更和删除互不影响其他记录', () => {
    reset();
    const store = useProgressStore.getState();
    store.ensureMovieRecord(4, {name: '未追踪'});
    assert.equal(store.getMovieRecord(4).global_status, undefined);
    store.setSeasonStatus(4, 1, 'Wish');
    store.setSeasonStatus(4, 2, 'Collect');
    store.removeRecord('tmdb_tv_4_s1');
    assert.equal(store.getSeasonRecord(4, 1), undefined);
    assert.equal(store.getSeasonRecord(4, 2).global_status, 'Collect');
    assert.ok(store.getMovieRecord(4));
    const persisted = JSON.parse(values.get('gridtrax-progress'));
    assert.equal(persisted.state.data.records.tmdb_tv_4_s2.global_status, 'Collect');
});

for (const status of ['Wish', 'Do', 'Collect', 'OnHold', 'Dropped']) {
    test(`取消电视剧 ${status} 状态保留该季进度、评分备注及其他记录，重新选择可继续使用`, () => {
        reset();
        const store = useProgressStore.getState();
        store.setSeasonStatus(10, 1, status, {name: '第1季', show_name: '测试剧', episode_count: 20});
        store.setSeasonStatus(10, 2, 'Collect');
        store.setMovieStatus(10, 'Wish');
        useProgressStore.setState(state => ({data: {...state.data, records: {...state.data.records,
            tmdb_tv_10_s1: {...state.data.records.tmdb_tv_10_s1, rating: 9, global_comment: '整季备注',
                last_interacted: 1, episodes: {1: {watched: true, comment: '单集备注'}, 2: {watched: false, comment: '待看'}}}
        }}}));
        const before = store.getSeasonRecord(10, 1);
        const otherSeason = store.getSeasonRecord(10, 2);
        const movie = store.getMovieRecord(10);
        store.setSeasonStatus(10, 1, undefined, {name: '不应覆盖', episode_count: 0});
        const cleared = store.getSeasonRecord(10, 1);
        assert.deepEqual(cleared, {...before, global_status: undefined, last_interacted: cleared.last_interacted});
        assert.ok(cleared.last_interacted > before.last_interacted);
        assert.equal(cleared.episodes, before.episodes);
        assert.equal(store.getSeasonRecord(10, 2), otherSeason);
        assert.equal(store.getMovieRecord(10), movie);
        const saved = JSON.parse(values.get('gridtrax-progress')).state.data.records.tmdb_tv_10_s1;
        assert.equal(saved.global_status, undefined);
        assert.deepEqual(saved.episodes, before.episodes);
        assert.equal(saved.rating, 9);
        assert.equal(saved.global_comment, '整季备注');
        store.setSeasonStatus(10, 1, 'Do');
        assert.equal(store.getSeasonRecord(10, 1).global_status, 'Do');
        assert.equal(store.getSeasonRecord(10, 1).episodes, before.episodes);
    });

    test(`取消电影 ${status} 状态保留记录与历史评分备注，并能重新选择`, () => {
        reset();
        const store = useProgressStore.getState();
        store.setMovieStatus(11, status, {name: '测试电影'});
        store.setMovieStatus(12, 'Collect');
        useProgressStore.setState(state => ({data: {...state.data, records: {...state.data.records,
            tmdb_movie_11: {...state.data.records.tmdb_movie_11, rating: 8, global_comment: '电影备注', last_interacted: 1}
        }}}));
        const before = store.getMovieRecord(11);
        const other = store.getMovieRecord(12);
        store.setMovieStatus(11, undefined, {name: '不应覆盖', poster_path: '/replacement.jpg'});
        const cleared = store.getMovieRecord(11);
        assert.deepEqual(cleared, {...before, global_status: undefined, last_interacted: cleared.last_interacted});
        assert.ok(cleared.last_interacted > before.last_interacted);
        assert.equal(store.getMovieRecord(12), other);
        const saved = JSON.parse(values.get('gridtrax-progress')).state.data.records.tmdb_movie_11;
        assert.equal(saved.global_status, undefined);
        assert.equal(saved.rating, 8);
        assert.equal(saved.global_comment, '电影备注');
        store.setMovieStatus(11, 'Wish');
        assert.equal(store.getMovieRecord(11).global_status, 'Wish');
        assert.equal(store.getMovieRecord(11).rating, 8);
    });
}

test('取消不存在的电影或季状态不会创建空记录', () => {
    reset();
    const before = useProgressStore.getState().data;
    useProgressStore.getState().setMovieStatus(99, undefined, {name: '未追踪'});
    useProgressStore.getState().setSeasonStatus(99, 1, undefined, {episode_count: 20});
    assert.equal(useProgressStore.getState().data, before);
    assert.deepEqual(before.records, {});
});

test('取消状态后重新恢复本地存储，仍未选择且保留单集观看进度', async () => {
    reset();
    const store = useProgressStore.getState();
    store.setSeasonStatus(20, 1, 'Do');
    store.toggleEpisodeWatched(20, 1, 3);
    store.setSeasonStatus(20, 1, undefined);
    store.setMovieStatus(21, 'Collect');
    store.setMovieStatus(21, undefined);
    const saved = values.get('gridtrax-progress');
    reset();
    values.set('gridtrax-progress', saved);
    await useProgressStore.persist.rehydrate();
    assert.equal(store.getSeasonRecord(20, 1).global_status, undefined);
    assert.equal(store.getSeasonRecord(20, 1).episodes[3].watched, true);
    assert.equal(store.getMovieRecord(21).global_status, undefined);
});
