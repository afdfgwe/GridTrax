import assert from 'node:assert/strict';
import test from 'node:test';
import {createBackup, parseBackup} from '../src/utils/dataBackup.ts';

// 备份兼容性测试：包含第 0 季、未设置状态的电影，以及界面已不再编辑的历史字段。
const progress = {
    user_id: 'local_user', last_sync: 123,
    records: {
        tmdb_tv_12_s0: {
            type: 'tv_season', tmdb_id: 12, season_number: 0,
            name: 'Specials', show_name: 'Show', poster_path: '/poster.jpg', episode_count: 18,
            global_status: 'Do', rating: 8, global_comment: 'Season note', last_interacted: 456,
            episodes: {1: {watched: true, comment: 'Episode note'}, 2: {watched: false, comment: ''}},
        },
        tmdb_movie_34: {type: 'movie', tmdb_id: 34, name: 'Movie', rating: 0, global_comment: ''},
    },
};

// 导出再导入应完整保留观影字段，同时不得原地修改传入的状态快照。
test('roundtrips all viewing fields without changing original data', () => {
    const before = structuredClone(progress);
    const backup = createBackup(progress);
    assert.equal(backup.metadata.version, 4);
    assert.deepEqual(parseBackup(JSON.stringify(backup)), progress);
    assert.deepEqual(progress, before);
});

// 兼容旧版结构，但过滤凭据和已删除集成字段，避免把历史密钥再次带入备份。
test('imports raw, v2 and v3 backups but strips credentials and legacy integration fields', () => {
    const legacy = structuredClone(progress);
    legacy.tmdb_api_key = 'old-secret';
    legacy.records.tmdb_tv_12_s0.bangumi_subject_id = 99;
    legacy.records.tmdb_tv_12_s0.bangumi_episode_ids = {1: 88};
    legacy.records.tmdb_tv_12_s0.bangumi_scanned = true;
    legacy.records.tmdb_tv_12_s0.episodes[1].token = 'old-secret';
    for (const input of [legacy, ...[2, 3].map(version => ({
        metadata: {version},
        progressData: legacy,
        bangumi: {token: 'old-secret'},
        settings: {tmdbApiKey: 'old-secret'}
    }))]) {
        assert.deepEqual(parseBackup(JSON.stringify(input)), progress);
    }
    assert.deepEqual(createBackup(legacy).progressData, progress);
    assert.ok(!JSON.stringify(createBackup(legacy)).includes('old-secret'));
});

// 畸形结构、未知版本和字段类型错误均应整体拒绝，而不是部分覆盖用户数据。
test('rejects malformed data and unsupported versions', () => {
    for (const input of [null, [], {}, {...progress, records: []}, {
        ...progress,
        records: {bad: progress.records.tmdb_movie_34}
    }, {metadata: {version: 5}, progressData: progress}]) {
        assert.throws(() => parseBackup(JSON.stringify(input)));
    }
    assert.throws(() => parseBackup('{broken'));
    for (const change of [
        record => {
            record.episodes[1].watched = 'true';
        },
        record => {
            record.episodes[1].comment = {};
        },
        record => {
            record.rating = 11;
        },
        record => {
            record.global_status = 'invalid';
        },
        record => {
            record.season_number = -1;
        },
        record => {
            record.type = 'unknown';
        },
    ]) {
        const invalid = structuredClone(progress);
        change(invalid.records.tmdb_tv_12_s0);
        assert.throws(() => parseBackup(JSON.stringify(invalid)));
    }
});

// 空记录是有效备份；旧接口返回的空海报应规范化为缺省字段而不是导入失败。
test('accepts an empty backup and missing/null posters from legacy TMDB data', () => {
    const empty = {...progress, records: {}};
    assert.deepEqual(parseBackup(JSON.stringify(empty)), empty);
    const legacy = structuredClone(progress);
    legacy.records.tmdb_movie_34.poster_path = null;
    assert.deepEqual(parseBackup(JSON.stringify(legacy)), progress);
});
