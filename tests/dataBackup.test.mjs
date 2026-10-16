import assert from 'node:assert/strict';
import test from 'node:test';
import {createBackup, parseBackup} from '../src/utils/dataBackup.ts';

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

test('roundtrips all viewing fields without changing original data', () => {
    const before = structuredClone(progress);
    const backup = createBackup(progress);
    assert.equal(backup.metadata.version, 4);
    assert.deepEqual(parseBackup(JSON.stringify(backup)), progress);
    assert.deepEqual(progress, before);
});

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

test('accepts an empty backup and missing/null posters from legacy TMDB data', () => {
    const empty = {...progress, records: {}};
    assert.deepEqual(parseBackup(JSON.stringify(empty)), empty);
    const legacy = structuredClone(progress);
    legacy.records.tmdb_movie_34.poster_path = null;
    assert.deepEqual(parseBackup(JSON.stringify(legacy)), progress);
});
