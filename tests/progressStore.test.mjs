import assert from 'node:assert/strict';
import test from 'node:test';

// 独立内存存储，测试永远不会读写用户浏览器中的实际观影记录。
const values = new Map();
globalThis.window = {
    localStorage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    }
};
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
