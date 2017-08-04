/* tslint:disable:no-magic-numbers */
import 'should';
import * as modelsafe from 'modelsafe';

import { Database } from './database';
import { attr } from './metadata';

/* tslint:disable:completed-docs */
@modelsafe.model()
class BadActor extends modelsafe.Model {
  @attr({ autoIncrement: true })
  @modelsafe.attr(modelsafe.INTEGER, { primary: true })
  @modelsafe.optional
  id: number;

  @modelsafe.attr(modelsafe.STRING)
  name: string;

  @modelsafe.attr(modelsafe.INTEGER)
  age: number;

  @modelsafe.assoc(modelsafe.HAS_ONE, () => BadActor)
  mentee: BadActor;

  @modelsafe.assoc(modelsafe.HAS_ONE, () => BadActor)
  duplicate: BadActor;
}
/* tslint:enable-completed-docs */

let db = new Database('sqlite://root:root@localhost/squell_test', {
  storage: ':memory:',
  logging: !!process.env.LOG_TEST_SQL
});

describe('Database', () => {
  describe('#sync', () => {
    it('should reject duplicate has-one foreign keys', async () => {
      db.define(BadActor);
      // Must throw an exception to succeed
      return db.sync({ force: true }).then(
        () => { throw new Error('Should fail'); },
        () => null);
    });
  });
});
