import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import { ArticlePost, Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { postsFixture } from './fixture/post';
import { notifyView } from '../src/common';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

jest.mock('../src/common', () => ({
  ...(jest.requireActual('../src/common') as Record<string, unknown>),
  notifyView: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

const agent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36';

describe('GET /r/:postId', () => {
  it('should return not found', () => {
    return request(app.server).get('/r/not').expect(404);
  });

  it('should redirect to post url', () => {
    return request(app.server)
      .get('/r/p1')
      .expect(302)
      .expect('Location', 'http://p1.com');
  });

  it('should render redirect html', async () => {
    await request(app.server)
      .get('/r/p1')
      .set('user-agent', agent)
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect('link', `<http://p1.com>; rel="preconnect"`)
      .expect(
        '<html><head><meta http-equiv="refresh" content="0;URL=http://p1.com"></head></html>',
      );
    expect(notifyView).toBeCalledTimes(0);
  });

  it('should render redirect html and notify view event', async () => {
    await request(app.server)
      .get('/r/p1')
      .set('user-agent', agent)
      .set('cookie', 'da2=u1')
      .set('referer', 'https://daily.dev')
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect('link', `<http://p1.com>; rel="preconnect"`)
      .expect(
        '<html><head><meta http-equiv="refresh" content="0;URL=http://p1.com"></head></html>',
      );
    expect(notifyView).toBeCalledWith(
      expect.anything(),
      'p1',
      'u1',
      'https://daily.dev',
      expect.anything(),
      ['javascript', 'webdev'],
    );
  });

  it('should render redirect html with hash value', async () => {
    await request(app.server)
      .get('/r/p1?a=id')
      .set('user-agent', agent)
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect('link', `<http://p1.com>; rel="preconnect"`)
      .expect(
        '<html><head><meta http-equiv="refresh" content="0;URL=http://p1.com#id"></head></html>',
      );
    expect(notifyView).toBeCalledTimes(0);
  });
});
