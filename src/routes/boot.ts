import { FastifyInstance } from 'fastify';
import { getAlerts } from '../schema/alerts';
import createOrGetConnection from '../db';
import { getSettings } from '../schema/settings';
import {
  ALERTS_DEFAULT,
  getUnreadNotificationsCount,
  SETTINGS_DEFAULT,
  SourceMember,
  SquadSource,
} from '../entity';
import { DataSource } from 'typeorm';
import { getSourceLink } from '../common';
import { GQLSource } from '../schema/sources';

const excludeProperties = <T, K extends keyof T>(
  obj: T,
  properties: K[],
): Omit<T, Exclude<keyof T, K>> => {
  if (obj) {
    properties.forEach((prop) => {
      delete obj[prop];
    });
  }
  return obj;
};

const getSquads = async (
  con: DataSource,
  userId: string,
): Promise<(GQLSource & { permalink: string })[]> => {
  const sources = await con
    .createQueryBuilder()
    .select('id')
    .addSelect('type')
    .addSelect('name')
    .addSelect('handle')
    .addSelect('image')
    .addSelect('NOT private', 'public')
    .addSelect('active')
    .from(SourceMember, 'sm')
    .innerJoin(
      SquadSource,
      's',
      'sm."sourceId" = s."id" and s."type" = \'squad\'',
    )
    .where('sm."userId" = :userId', { userId })
    .orderBy('s.name', 'ASC')
    .getRawMany<GQLSource>();
  return sources.map((source) => ({
    ...source,
    permalink: getSourceLink(source),
  }));
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const con = await createOrGetConnection();
    const { userId } = req;
    if (userId) {
      const [alerts, settings, unreadNotificationsCount, squads] =
        await Promise.all([
          getAlerts(con, userId),
          getSettings(con, userId),
          getUnreadNotificationsCount(con, userId),
          getSquads(con, userId),
        ]);
      return res.send({
        alerts: excludeProperties(alerts, ['userId']),
        settings: excludeProperties(settings, [
          'userId',
          'updatedAt',
          'bookmarkSlug',
        ]),
        notifications: { unreadNotificationsCount },
        squads,
      });
    }
    return res.send({
      alerts: ALERTS_DEFAULT,
      settings: SETTINGS_DEFAULT,
      notifications: { unreadNotificationsCount: 0 },
      squads: [],
    });
  });
}
